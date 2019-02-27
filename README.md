# Cognito CLI
Small CLI tool to obtain a JWT from a Cognito userpool. Supports multiple userpools ordered by stages.

# Usage
* Clone repo & `npm install -g`
* New config will be created at `~/.cognito-cli/config.json`
* Provide credentials in the config file
* Run the global command `cognito`

## Configuration
This is the example `~/.cognito-cli/config.json`:
```JSON
{
    "pools": [
        {
            "name": "Example",
            "dev": {
                "poolId": "eu-west-1_1234567",
                "clientId": "abc123456",
                "username": "user",
                "password": "passwd"
            }
        }
    ]
}
```
You can add as many `pools` with `stages`. Example:
```JSON
{
    "pools": [
        {
            "name": "Application 1",
            "test123": {
                "poolId": "eu-west-1_1234567",
                "clientId": "abc123456",
                "username": "user",
                "password": "passwd"
            }
        },
        {
            "name": "Something else",
            "hello": {
                "poolId": "eu-west-1_1234567",
                "clientId": "abc123456",
                "username": "user",
                "password": "passwd"
            }
        }
    ]
}
```

## CLI
You can run the global command `cognito`.

### Running without arguments
When you run just `cognito` without args you will be prompted with all possible pools & stages:

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

### Running with commands
This CLI tool also allows the following arguments:
```
Usage: cognito [options]

Options:
  -V, --version        output the version number
  -p, --pool [name]    Use the pool by [name]
  -s, --stage [stage]  Use the [stage]
  -c, --copy           Copy the token directly to clipboard
  -h, --help           output usage information
```