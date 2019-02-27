#!/usr/bin/env node

"use strict";
var fs = require('fs');
var ncp = require("copy-paste");
var inquirer = require("inquirer");

var configFolderPath = process.env.HOME + "/.cognito-cli/";
var configFileName = "config.json";

initEnvironment()
var config = require(configFolderPath + configFileName);
promptPoolType();

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
        process.exit();
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
                .catch(err => {
                    console.error(`\nFailed to get JWT: ${err.code} - ${err.message}`);
                });
        });
}

function getAvailablePoolNames() {
    return config.pools.map(pools => pools.name);
}

function getAvailableStages(poolName) {
    return Object.keys(config.pools.filter(pools => pools.name == poolName)[0]).filter(key => key != "name");
}

function getStage(poolName, stageName) {
    return config.pools.filter(pools => pools.name == poolName)[0][stageName];
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