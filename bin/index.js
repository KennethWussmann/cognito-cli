#!/usr/bin/env node

"use strict";
const fs = require("fs");
const ncp = require("copy-paste");
const inquirer = require("inquirer");
const express = require("express");
const OTPAuth = require("otpauth");
const Auth = require("aws-amplify").Auth;
const packageJson = require("../package.json");
const { program } = require("commander");

const configFolderPath = process.env.HOME + "/.cognito-cli/";
const configFileName = "config.json";

initEnvironment();
const config = require(configFolderPath + configFileName);

(async () => {
  if (process.argv.length <= 2) {
    promptPoolType().then((poolName) =>
      promptStage(poolName).then((stageName) => {
        let stage = getStage(poolName, stageName);
        auth(stage)
          .then((jwt) => {
            if (jwt != null) {
              console.log(`\n${jwt}`);
              ncp.copy(jwt, () => {
                console.log(
                  `\nCopied JWT for ${poolName} ${stageName.toUpperCase()} to clipboard!`
                );
              });
            }
          })
          .catch((err) => printAWSError(err));
      })
    );
  } else {
    await parseCliArguments();
  }
})();

function initEnvironment() {
  if (!fs.existsSync(configFolderPath)) {
    fs.mkdirSync(configFolderPath);
  }
  if (!fs.existsSync(configFolderPath + configFileName)) {
    fs.writeFileSync(
      configFolderPath + configFileName,
      JSON.stringify(
        {
          settings: {
            port: 8080,
          },
          pools: [
            {
              name: "Example",
              dev: {
                poolId: "eu-west-1_1234567",
                region: "eu-west-1",
                clientId: "abc123456",
                username: "user",
                password: "passwd",
                otpSecret: null,
              },
            },
          ],
        },
        null,
        2
      )
    );
    console.log(
      `\n\nCreated default configuration file at "${
        configFolderPath + configFileName
      }"`
    );
    console.log(
      "Use the global command 'cognito' to generate fresh JWT tokens.\n\n"
    );
    process.exit(0);
  }
}

async function parseCliArguments() {
  program
    .version(packageJson.version)
    .option(`-p, --pool [name]`, "Use the pool by [name]")
    .option(`-s, --stage [stage]`, "Use the [stage]")
    .option(`-c, --copy`, "Copy the token directly to clipboard")
    .option(
      `-S, --server [port]`,
      "Start a local webserver that can serve tokens"
    )
    .option(`-t, --token [token]`, "Token for MFA challenge")
    .parse();

  const options = program.opts();

  if (options.server) {
    webserver(options.server);
    return;
  }

  if (!options.pool && !options.stage) {
    console.error(
      "Please specify either a pool or a stage. See --help for help."
    );
    process.exit(1);
  }

  if (!options.pool) {
    await promptPoolType().then(
      (poolName) => (options.pool = poolName.toLowerCase())
    );
  }

  if (!options.stage) {
    await promptStage(options.pool).then(
      (stageName) => (options.stage = stageName.toLowerCase())
    );
  }

  if (!isPoolName(options.pool)) {
    console.error("Pool not found in configuration");
    process.exit(1);
  }

  if (!isStageName(options.pool, options.stage)) {
    console.error("Stage for pool not found in configuration");
    process.exit(1);
  }

  auth(getStage(options.pool, options.stage), options.token)
    .then((jwt) => {
      if (options.copy) {
        ncp.copy(jwt);
      }
      console.log(jwt);
    })
    .catch((err) => printAWSError(err));
}

async function promptPoolType() {
  return new Promise((resolve, reject) => {
    inquirer
      .prompt({
        type: "list",
        name: "poolType",
        message: "What pool type would you like to use?",
        choices: getAvailablePoolNames(),
      })
      .then((poolTypeAnswers) => {
        resolve(poolTypeAnswers.poolType);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function promptStage(poolName) {
  return new Promise((resolve, reject) => {
    inquirer
      .prompt({
        type: "list",
        name: "stage",
        message: "And for what stage?",
        choices: getAvailableStages(poolName),
      })
      .then((stageAnswers) => {
        resolve(stageAnswers.stage);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function printAWSError(err) {
  console.error(`\nFailed to get JWT: ${err.code} - ${err.message}`);
  process.exit(1);
}

function isPoolName(poolName) {
  return getAvailablePoolNames()
    .map((name) => name.toLowerCase())
    .includes(poolName.toLowerCase());
}

function isStageName(poolName, stageName) {
  return getAvailableStages(poolName)
    .map((name) => name.toLowerCase())
    .includes(stageName.toLowerCase());
}

function getAvailablePoolNames() {
  return config.pools.map((pools) => pools.name);
}

function getAvailableStages(poolName) {
  const pool = config.pools.filter(
    (pools) => pools.name.toLowerCase() === poolName.toLowerCase()
  )[0];
  return Object.keys(pool).filter((key) => key !== "name");
}

function getStage(poolName, stageName) {
  const pool = config.pools.filter(
    (pools) => pools.name.toLowerCase() === poolName.toLowerCase()
  )[0];
  const stage = Object.keys(pool).filter(
    (stg) => stg.toLowerCase() === stageName.toLowerCase()
  );
  return pool[stage];
}

async function auth(stage, cliToken) {
  await Auth.configure({
    region: stage.region ?? "eu-central-1",
    userPoolId: stage.poolId,
    userPoolWebClientId: stage.clientId,
  });
  const user = await Auth.signIn(stage.username, stage.password);
  if (user.challengeName === "SOFTWARE_TOKEN_MFA") {
    if (cliToken == null) {
      if (stage.otpSecret) {
        await Auth.confirmSignIn(
          user,
          generateTotp(stage.otpSecret),
          user.challengeName
        );
      } else {
        await Auth.confirmSignIn(
          user,
          await promptMfaToken(),
          user.challengeName
        );
      }
    } else {
      await Auth.confirmSignIn(user, cliToken, user.challengeName);
    }
  }
  const response = await Auth.currentSession();
  return response.getIdToken().getJwtToken();
}

function generateTotp(secret) {
  return new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

function promptMfaToken() {
  return new Promise((resolve, reject) => {
    inquirer
      .prompt({
        type: "input",
        name: "mfaToken",
        message: "Please enter MFA token:",
      })
      .then((answers) => {
        resolve(answers.mfaToken);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function webserver(port) {
  if (port === true) {
    port = config.settings?.port ?? 8080;
  }

  const app = express();

  app.get("/:pool/:stage", function (req, res) {
    const stage = req.params["stage"];
    const pool = req.params["pool"];
    const token = req.query.token;

    auth(getStage(pool, stage), token)
      .then((jwt) => {
        res.json({
          token: jwt,
        });
      })
      .catch((err) => {
        res.status(400);
        res.json({
          ...err,
          token: null,
        });
      });
  });

  app.listen(port, function () {
    console.log("Available pools and stages:");
    getAvailablePoolNames().forEach((pool) => {
      console.log("➜", pool);
      getAvailableStages(pool).forEach((stageName) => {
        const stage = getStage(pool, stageName);
        console.log(
          "  ↳",
          stageName,
          stage.otpSecret ? "(automatic MFA handling)" : ""
        );
      });
    });
    console.log(
      `\nStarted local webserver: http://localhost:${port}/{pool}/{stage}`
    );
    console.log(`Add '?token=123456' to specify MFA token if needed.\n`);
  });
}
