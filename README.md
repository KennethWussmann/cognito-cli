# Cognito CLI
Small CLI tool to obtain a JWT from a Cognito userpool. Supports multiple userpools ordered by stages.

# Usage
* Clone repo & `npm install`
* Rename `example.config.json` to `config.json`
* Provide credentials in the config.json
* `npm start`

**Shows list of applications configured**
```
? What pool type would you like to use? (Use arrow keys)
❯ Application 1
  Application 2
```

**Shows available stages for this application**
```
? What pool type would you like to use? Application 1
? And for what stage?
  dev
❯ int
  prd
```

**Copies the obtained JWT to your clipboard (macOS, Linux & Windows)** 
```
Copied JWT for Application 1 INT to clipboard!
```