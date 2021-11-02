# :guardsman: cognito-cli

Small CLI tool to obtain a JWT from a Cognito userpools. Supports multiple userpools ordered by stages and MFA.

## :rocket: Usage

- Install globally `npm install -g cogcli`
- New config will be created at `~/.cognito-cli/config.json`
- Provide credentials in the config file
- Run the global command `cognito`

## :books: Configuration

This is the example `~/.cognito-cli/config.json`:

```JSON
{
    "settings": {
      "port": 8080
    },
    "pools": [
        {
            "name": "Example",
            "dev": {
                "poolId": "eu-west-1_1234567",
                "clientId": "abc123456",
                "username": "user",
                "password": "passwd",
                "otpSecret": "OPTIONAL_OTPSECRET"
            }
        }
    ]
}
```

With `port` the default port for the local webserver can be globally adjusted.

You can add as many `pools` with `stages`. Example:

```JSON
{
    "settings": {
      "port": 8080
    },
    "pools": [
        {
            "name": "Application 1",
            "test123": {
                "poolId": "eu-west-1_1234567",
                "clientId": "abc123456",
                "username": "user",
                "password": "passwd",
                "otpSecret": "OPTIONAL_OTPSECRET"
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

## :arrows_clockwise: MFA Support

When the Cognito user requires MFA login:

- You can supply the OTP secret which can be used to generate a token in the config via `otpSecret`
- If no `otpSecret` present you will be prompted to enter the token manually
- You can also use `--token 123456` to supply the token directly
- When using the local webserver you can use the `?token=123456` query parameter with your request

> :bangbang:️ Notice that this tool is for development purposes only.
> Never hold confidential credentials together with MFA secrets in a plain-text file.

## :man_technologist: CLI

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

### Running with arguments

This CLI tool also allows the following arguments:

```
Usage: cognito [options]

Options:
  -V, --version        output the version number
  -p, --pool [name]    Use the pool by [name]
  -s, --stage [stage]  Use the [stage]
  -c, --copy           Copy the token directly to clipboard
  -S, --server [port]  Start a local webserver that can serve tokens
  -t, --token [token]  Token for MFA challenge
  -h, --help           display help for command
```

## :globe_with_meridians: Local webserver

Using `cognito -S` will start a local webserver (default on port 8080) that can be used to retrieve a JWT token for pool & stage.
The webserver has the following endpoint:

- `GET /{pool}/{stage}` - Get a fresh JWT token (no caching!)
- `GET /{pool}/{stage}?token=123456` - Get a fresh JWT token with MFA token if required

### Examples

```
$ curl -X GET http://localhost:8080/example/dev
{
  "token": "eyJra..."
}
```

That's useful for example in REST clients like Insomnia or Postman to chain requests: Get Token -> Post something.
