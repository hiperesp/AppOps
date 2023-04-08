import { exec } from 'child_process';

const kHost = Symbol('host');
const kPort = Symbol('port');
const kUsername = Symbol('username');
const kPrivateKey = Symbol('privateKey');

const kExecCommand = Symbol('execCommand');
const kExecAppCommands = Symbol('execAppCommands');
const kNormalizeAppNames = Symbol('normalizeAppNames');
const kExecMultipleCommands = Symbol('execMultipleCommands');
const kCreateAppCommand = Symbol('createAppCommand');

export default class DokkuSSH {

    [kHost];
    [kPort];
    [kUsername];
    [kPrivateKey];

    async actionPsScale(appOrApps, scaling, onLog = null) {
        const scalingParams = [];
        for(const type in scaling) {
            this.mustBeValidResourceName(type);
            scalingParams.push(`${type}=${parseInt(scaling[type])}`);
        }
        await this[kExecAppCommands](appOrApps, `ps:scale %app% ${scalingParams.join(' ')}`, onLog);
    }

    async nginxAccessLogs(appOrApps) {
        const result = await this[kExecAppCommands](appOrApps, 'nginx:access-logs %app%');

        const output = {};
        for(const app in result) {
            const logLines = result[app].split('\n');
            logLines.pop(); // remove last empty line
            output[app] = logLines.join('\n');
        }

        return output;
    }

    async nginxErrorLogs(appOrApps) {
        const result = await this[kExecAppCommands](appOrApps, 'nginx:error-logs %app%');

        const output = {};
        for(const app in result) {
            const logLines = result[app].split('\n');
            logLines.pop(); // remove last empty line
            output[app] = logLines.join('\n');
        }

        return output;
    }

    async logs(appOrApps) {
        const result = await this[kExecAppCommands](appOrApps, 'logs %app%');

        const output = {};
        for(const app in result) {
            const logLines = result[app].split('\n');
            logLines.pop(); // remove last empty line

            const instancesLogs = {};
            for(const logLine of logLines) {
                const instanceName = /^\u001b\[\d*m\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z (((?!:).)+)/.exec(logLine)[1];
                if(!instancesLogs[instanceName]) {
                    instancesLogs[instanceName] = [];
                }
                instancesLogs[instanceName].push(logLine);
            }

            //sort by instance name
            const instancesLogsSorted = {};
            Object.keys(instancesLogs).sort().forEach(function(key) {
                instancesLogsSorted[key] = instancesLogs[key];
            });
            output[app] = Object.values(instancesLogsSorted).map(instanceLogs => instanceLogs.join('\n')).join('\n');
        }

        return output;
    }

    async ping() {
        await this[kExecCommand]('version');
    }

    async domainsReport(appOrApps) {
        const domainsResult = await this[kExecAppCommands](appOrApps, 'domains:report %app%');
        const output = {};
        for(const app in domainsResult) {

            const domainsConfigs = domainsResult[app].split('\n');
            domainsConfigs.shift(); // remove header
            domainsConfigs.pop(); // remove last empty line

            const configs = {
                app: {
                    enabled: false,
                    vhosts: [],
                },
                global: {
                    enabled: false,
                    vhosts: [],
                },
            };
            for(const domainConfig of domainsConfigs) {
                const [type, config, configValue] = domainConfig.trim().replace(/Domains (app|global) (enabled|vhosts):\s+/g, '$1,$2,').split(',');
                if(config === 'vhosts') {
                    configs[type][config] = configValue.split(' ');
                } else {
                    configs[type][config] = configValue === 'true';
                }
            }
            const appOutput = {
                app: [],
                global: [],
            };
            if(configs.app.enabled) {
                appOutput.app.push(...configs.app.vhosts);
            }
            if(configs.global.enabled) {
                for(const vhost of configs.global.vhosts) {
                    appOutput.global.push(`${app}.${vhost}`);
                }
            }
            output[app] = appOutput;
        }
        return output;
    }

    async appsList() {
        const appsResult = await this[kExecCommand]('apps:list');
        const apps = appsResult.split('\n');
        apps.shift(); // remove header
        apps.pop(); // remove last empty line
        apps.pop(); // remove last empty line
        return apps;
    }

    async proxyPorts(appOrApps) {
        const output = {};
        const proxyPortsResult = await this[kExecAppCommands](appOrApps, 'proxy:ports %app%');
        for(const app in proxyPortsResult) {
            const proxyPorts = proxyPortsResult[app].split('\n');
            proxyPorts.shift(); // remove header
            proxyPorts.shift(); // remove second header
            proxyPorts.pop(); // remove last empty line

            const proxyPortsApp = [];
            for(const proxyPort of proxyPorts) {
                const [protocol, acessiblePort, containerPort] = proxyPort.trim().replace(/\s+/g, ':').split(':');
                proxyPortsApp.push(`${protocol}:${acessiblePort}:${containerPort}`);
            }
            output[app] = proxyPortsApp;
        }
        return output;
    }

    async psScale(appOrApps) {
        const output = {};
        const psScaleResult = await this[kExecAppCommands](appOrApps, 'ps:scale %app%');
        for(const app in psScaleResult) {
            const psScaleLines = psScaleResult[app].split('\n');
            psScaleLines.shift(); // remove header
            psScaleLines.shift(); // remove table header
            psScaleLines.shift(); // remove table header separator
            psScaleLines.pop(); // remove last empty line
            const psScaleApp = {};
            for(const psScaleLine of psScaleLines) {
                const [process, quantity] = psScaleLine.trim().split(':').map(value => value.trim());
                psScaleApp[process] = Number(quantity);
            }
            output[app] = psScaleApp;
        }
        return output;
    }

    async [kExecAppCommands](appOrApps, command, onLog = null, appNameVar = '%app%') {
        const apps = this[kNormalizeAppNames](appOrApps);
        const responses = await this[kExecMultipleCommands](this[kCreateAppCommand](apps, command, appNameVar), onLog ? function(log, index) {
            onLog(log, apps[index]);
        } : null);

        const output = {};
        for (let i = 0; i < apps.length; i++) {
            output[apps[i]] = responses[i];
        }

        return output;
    }

    [kNormalizeAppNames](appOrApps) {
        if(typeof appOrApps === 'string') {
            return this[kNormalizeAppNames]([appOrApps]);
        }
        if(appOrApps && appOrApps?.name) {
            return this[kNormalizeAppNames](appOrApps.name);
        }
        const apps = appOrApps.map(app => app.trim()).filter(app => !!app);
        this.mustBeValidResourceNameArr(apps);
        return apps;
    }

    [kCreateAppCommand](apps, command, appNameVar = '%app%') {
        return apps.map(app => app.trim()).filter(app => !!app).map(app => command.replace(appNameVar, app));
    }

    async [kExecMultipleCommands](commands, onLog = null) {

        const separator = {
            command: 'version',
            regex: /^dokku version \d+\.\d+\.\d+\n/gm,
        }

        const newCommands = [];
        for (const command of commands) {
            newCommands.push(command);
            newCommands.push(separator.command);
        }
        let logIndex = 0;
        let response = await this[kExecCommand](newCommands.join('\n'), onLog ? function(data) {
            data = data.split(separator.regex)
            for(const key in data) {
                onLog(data[key], logIndex+parseInt(key));
            }
            logIndex += data.length - 1;
        } : null);
        
        response = response.split(separator.regex);
        return response;
    }

    [kExecCommand](command, onLog = null) {
        return new Promise((resolve, reject) => {
            exec(`
TMP_FILE=$(mktemp)
echo "${this[kPrivateKey].replace(/\r?\n/g, '\\\\n')}" >> $TMP_FILE
chmod 600 $TMP_FILE
ssh -o StrictHostKeyChecking=no ${this[kUsername]}@${this[kHost]} -p ${this[kPort]} -i $TMP_FILE 'shell' <<EOF
${command}
EOF
            `.trim(), (error, stdout, stderr) => {
                if (error) {
                    reject(error.code, stderr);
                } else {
                    resolve(stdout);
                }
            }).stdout.on('data', function(data) {
                if(onLog) {
                    onLog(data);
                }
            });
        });
    }
            

    static create(serverConnectionInfo) {
        const dokkuSSH = new DokkuSSH();

        dokkuSSH[kHost] = serverConnectionInfo.host;
        dokkuSSH[kPort] = Number(serverConnectionInfo.port);
        dokkuSSH[kUsername] = serverConnectionInfo.username;
        dokkuSSH[kPrivateKey] = serverConnectionInfo.privateKey;

        return dokkuSSH;
    }

    mustBeValidResourceNameArr(resourceNameArr) {
        for(const resourceName of resourceNameArr) {
            this.mustBeValidResourceName(resourceName);
        }
    }

    mustBeValidResourceName(resourceName) {
        if(!this.isValidResourceName(resourceName)) {
            throw new Error(`Invalid resource name: ${resourceName}`);
        }
    }

    isValidResourceName(resourceName) {
        //must contain only letters, numbers, and hyphens.
        //must not start with a hyphen.
        //must not end with a hyphen.
        //must not contain consecutive hyphens.
        if(!resourceName.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) return false;

        //must be between 2 and 63 characters long.
        if(resourceName.length > 63 || resourceName.length < 2) return false;

        return true;
    }
}