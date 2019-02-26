"use strict";
var ncp = require("copy-paste");
var inquirer = require("inquirer");
var config = require("./config.json");

console.log("");

promptPoolType();

function promptPoolType() {
    inquirer
        .prompt({
            type: "list",
            name: "poolType",
            message: "What pool type would you like to use?",
            choices: config.pools.map(pools => pools.name)
        })
        .then(poolTypeAnswers => {
            promptStage(poolTypeAnswers);
        });
}

function promptStage(poolTypeAnswers) {
    var pool = config.pools.filter(pools => pools.name == poolTypeAnswers.poolType)[0];
    var stages = Object.keys(pool).filter(key => key != "name");

    inquirer
        .prompt({
            type: "list",
            name: "stage",
            message: "And for what stage?",
            choices: stages
        })
        .then(stageAnswers => {
            var stage = pool[stageAnswers.stage];
            auth(stage)
                .catch(err => {
                    console.error(`\nFailed to get JWT: ${err.code} - ${err.message}`);
                })
                .then(jwt => {
                    if (jwt != null) {
                        console.log(`\n${jwt}`);
                        ncp.copy(jwt, () => {
                            console.log(`\nCopied JWT for ${poolTypeAnswers.poolType} ${stageAnswers.stage.toUpperCase()} to clipboard!`);
                        });
                    }
                });
        });
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