#!/usr/bin/env node

"use strict";
var fs = require("fs");
var ncp = require("copy-paste");
var inquirer = require("inquirer");
var express = require('express');

var configFolderPath = process.env.HOME + "/.cognito-cli/";
var configFileName = "config.json";

initEnvironment()
var config = require(configFolderPath + configFileName);

(async () => {
    if (process.argv.length <= 2) {
        promptPoolType().then(poolName => promptStage(poolName).then(stageName => {
            let stage = getStage(poolName, stageName);
            auth(stage)
                .then(jwt => {
                    if (jwt != null) {
                        console.log(`\n${jwt}`);
                        ncp.copy(jwt, () => {
                            console.log(`\nCopied JWT for ${poolName} ${stageName.toUpperCase()} to clipboard!`);
                        });
                    }
                })
                .catch(err => printAWSError(err))
        }));
    } else {
        await parseCliArguments();
    }
})();

function initEnvironment() {
    if (!fs.existsSync(configFolderPath)) {
        fs.mkdirSync(configFolderPath);
    }
    if (!fs.existsSync(configFolderPath + configFileName)) {
        fs.writeFileSync(configFolderPath + configFileName, JSON.stringify({
            pools: [{
                name: "Example",
                dev: {
                    poolId: "eu-west-1_1234567",
                    clientId: "abc123456",
                    username: "user",
                    password: "passwd"
                }
            }]
        }, null, 4));
        console.log(`\n\nCreated default configuration file at "${configFolderPath + configFileName}"`);
        console.log("Use the global command 'cognito' to generate fresh JWT tokens.\n\n");
        process.exit(0);
    }
}

async function parseCliArguments() {
    var cli = require("commander");

    cli.version("1.0.0")
        .option(`-p, --pool [name]`, "Use the pool by [name]")
        .option(`-s, --stage [stage]`, "Use the [stage]")
        .option(`-c, --copy`, "Copy the token directly to clipboard")
        .option(`-S, --server [port]`, "Start a local webserver that can serve tokens")
        .parse(process.argv);

    if (cli.server) {
        webserver(cli.server);
        return;
    }

    if (!cli.pool && !cli.stage) {
        console.error("Please specify either a pool or a stage. See --help for help.");
        process.exit(1);
    }

    if (!cli.pool) {
        await promptPoolType().then(poolName => cli.pool = poolName.toLowerCase());
    }

    if (!cli.stage) {
        await promptStage(cli.pool).then(stageName => cli.stage = stageName.toLowerCase());
    }

    if (!isPoolName(cli.pool)) {
        console.error("Pool not found in configuration");
        process.exit(1);
    }

    if (!isStageName(cli.pool, cli.stage)) {
        console.error("Stage for pool not found in configuration");
        process.exit(1);
    }

    auth(getStage(cli.pool, cli.stage))
        .then(jwt => {
            if (cli.copy) {
                ncp.copy(jwt);
            }
            console.log(jwt);
        })
        .catch(err => printAWSError(err));
}

async function promptPoolType() {
    return new Promise((resolve, reject) => {
        inquirer
            .prompt({
                type: "list",
                name: "poolType",
                message: "What pool type would you like to use?",
                choices: getAvailablePoolNames()
            })
            .then(poolTypeAnswers => {
                resolve(poolTypeAnswers.poolType);
            })
            .catch(err => {
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
                choices: getAvailableStages(poolName)
            })
            .then(stageAnswers => {
                resolve(stageAnswers.stage);
            })
            .catch(err => {
                reject(err);
            });
    });
}

function printAWSError(err) {
    console.error(`\nFailed to get JWT: ${err.code} - ${err.message}`);
    process.exit(1);
}

function isPoolName(poolName) {
    return getAvailablePoolNames().map(name => name.toLowerCase()).includes(poolName.toLowerCase());
}

function isStageName(poolName, stageName) {
    return getAvailableStages(poolName).map(name => name.toLowerCase()).includes(stageName.toLowerCase());
}

function getAvailablePoolNames() {
    return config.pools.map(pools => pools.name);
}

function getAvailableStages(poolName) {
    var pool = config.pools.filter(pools => pools.name.toLowerCase() == poolName.toLowerCase())[0];
    return Object.keys(pool)
        .filter(key => key != "name");
}

function getStage(poolName, stageName) {
    var pool = config.pools.filter(pools => pools.name.toLowerCase() == poolName.toLowerCase())[0];
    var stage = Object.keys(pool).filter(stg => stg.toLowerCase() == stageName.toLowerCase());
    return pool[stage];
}

function auth(stage) {
    return new Promise((resolve, reject) => {
        global.fetch = require("node-fetch")
        var AmazonCognitoIdentity = require("amazon-cognito-identity-js");
        var cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: stage.username,
            Pool: new AmazonCognitoIdentity.CognitoUserPool({
                UserPoolId: stage.poolId,
                ClientId: stage.clientId
            })
        });
        cognitoUser.authenticateUser(new AmazonCognitoIdentity.AuthenticationDetails({
            Username: stage.username,
            Password: stage.password,
        }), {
            onSuccess: (result) => {
                var accessToken = result.getAccessToken().getJwtToken();
                var idToken = result.idToken.jwtToken;
                resolve(idToken);
            },
            onFailure: (err) => reject(err),
            newPasswordRequired: (err) => reject({
                message: "Password needs to be changed!"
            }),
        });
    });
}

function webserver(port) {
    if (port === true) {
        port = 8080
    }

    var app = express();

    app.get("/:pool/:stage", function (req, res) {
        var stage = req.params["stage"];
        var pool = req.params["pool"];

        auth(getStage(pool, stage))
            .then(jwt => {
                res.json({
                    token: jwt
                });
            })
            .catch(err => printAWSError(err));
    });

    app.listen(port, function () {
        console.log(`Started local webserver: http://localhost:${port}/{pool}/{stage}`);
    });
}