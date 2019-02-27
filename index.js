#!/usr/bin/env node

"use strict";
var fs = require("fs");
var ncp = require("copy-paste");
var inquirer = require("inquirer");

var configFolderPath = process.env.HOME + "/.cognito-cli/";
var configFileName = "config.json";

initEnvironment()
var config = require(configFolderPath + configFileName);

if (process.argv.length <= 2) {
    promptPoolType();
} else {
    var cli = require("commander");

    cli.version("1.0.0")
        .option(`-p, --pool [name]`, "Use the pool by [name]")
        .option(`-s, --stage [stage]`, "Use the [stage]")
        .option(`-c, --copy`, "Copy the token directly to clipboard")
        .parse(process.argv);
    
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

function initEnvironment() {
    if (!fs.existsSync(configFolderPath)) {
        fs.mkdirSync(configFolderPath);
    }
    if (!fs.existsSync(configFolderPath + configFileName)) {
        fs.writeFileSync(configFolderPath + configFileName, JSON.stringify({
            pools: [
                {
                    name: "Example",
                    dev: {
                        poolId: "eu-west-1_1234567",
                        clientId: "abc123456",
                        username: "user",
                        password: "passwd"
                    }
                }
            ]
        }, null, 4));
        console.log(`\n\nCreated default configuration file at "${configFolderPath + configFileName}"`);
        console.log("Use the global command 'cognito' to generate fresh JWT tokens.\n\n");
        process.exit(0);
    }
}

function promptPoolType() {
    inquirer
        .prompt({
            type: "list",
            name: "poolType",
            message: "What pool type would you like to use?",
            choices: getAvailablePoolNames()
        })
        .then(poolTypeAnswers => {
            promptStage(poolTypeAnswers.poolType);
        });
}

function promptStage(poolName) {
    inquirer
        .prompt({
            type: "list",
            name: "stage",
            message: "And for what stage?",
            choices: getAvailableStages(poolName)
        })
        .then(stageAnswers => {
            auth(getStage(poolName, stageAnswers.stage))
                .then(jwt => {
                    if (jwt != null) {
                        console.log(`\n${jwt}`);
                        ncp.copy(jwt, () => {
                            console.log(`\nCopied JWT for ${poolName} ${stageAnswers.stage.toUpperCase()} to clipboard!`);
                        });
                    }
                })
                .catch(err => printAWSError(err));
        });
}

function printAWSError(err) {
    console.error(`\nFailed to get JWT: ${err.code} - ${err.message}`);
    process.exit(1);
}

function isPoolName(poolName) {
    return getAvailablePoolNames().map(name => name.toLowerCase()).includes(poolName);
}

function isStageName(poolName, stageName) {
    return getAvailableStages(poolName).map(name => name.toLowerCase()).includes(stageName);
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
    return config.pools.filter(pools => pools.name.toLowerCase() == poolName.toLowerCase())[0][stageName];
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