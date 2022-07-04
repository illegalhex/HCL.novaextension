class TFlanguageServer{
    
    constructor() {
        nova.config.observe('hcl.terraform-ls-binary', function (path) {
            this.start(path);
        }, this);
    }
    
    deactivate() {
        this.stop();
    }
    
    restart() {
        if (this.crashAlert) {
          this.crashAlert.dispose()
          this.crashAlert = null
        }
        if (this.languageClient) {
          let alertDisposable = this.languageClient.onDidStop((err) => {
            alertDisposable.dispose()
            if (err === undefined) {
              this.start()
            } else {
              console.error(`Problem stopping client during restart: ${err}`)
            }
          })
          this.languageClient.stop()
          nova.subscriptions.remove(this.languageClient)
          this.languageClient = null
        } else {
          this.start()
        }
      }
    
    start(path) {
        if (this.languageClient) {
            this.languageClient.stop();
            nova.subscriptions.remove(this.languageClient);
        }
        
        if (!path) {
            console.log("hcl.terraform-ls-binary not set, finding in path");
            path = findTFLSBin();
        }
        
        var serverOptions = {
            path: path,
            args: ["serve"]
        }
        
        var clientOptions = {
            syntaxes : ["terraform"]
        }
        
        var client = new LanguageClient('tf-langserver', 'Terraform Language Server', serverOptions, clientOptions);
        
        this.crashAlert = client.onDidStop(async (err) => {
          console.error(`Language server stopped: ${err}`)
          if (err !== undefined) {
            let crashMsg = new NotificationRequest('server-crash')
            crashMsg.title = nova.localize('Language Server Crash')
            crashMsg.body = nova.localize(
              'terraform langserver has crashed. If this issue persists after restarting, ' +
                'please open a bug report and include console messages.'
            )
            crashMsg.actions = [nova.localize('Restart'), nova.localize('Ignore')]
            let resp = await nova.notifications.add(crashMsg)
            this.stop()
            if (resp.actionIdx === 0) {
              this.start()
            }
          }
        })
        
        try {
            client.start();
            nova.subscriptions.add(client);
            this.languageClient = client;
        }

        catch (err) {
            if (nova.inDevMode()) {
                console.error(`Error with startup: ${err}`);
            }
        }
    }
    stop() {
        if (this.crashAlert) {
          this.crashAlert.dispose()
          this.crashAlert = null
        }
        if (this.languageClient) {
            this.languageClient.stop();
            nova.subscriptions.remove(this.languageClient);
            this.languageClient = null;
            console.log("The language server stoped");
        }
    }
}
exports.TFlanguageServer = TFlanguageServer;

function findTFLSBin() {
    var paths = nova.environment.PATH.split(":");
    for (let path of paths) {
        if (nova.fs.stat(`${path}/terraform-ls`)){
            console.log(`Using ${path}/terraform-ls`);
            return `${path}/terraform-ls`;
        }
    }
    throw new Error("Can't find terraform-ls in your PATH. Please ensure that the binary exists or set folder manually") 
}