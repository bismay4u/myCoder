const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');
const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');

const COMMANDS = require("./misc/commands.json");
var SCRIPTS = false;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Temp directory for code execution
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
async function ensureTempDir() {
   try {
       await fs.access(TEMP_DIR);
   } catch {
       await fs.mkdir(TEMP_DIR, { recursive: true });
   }
}

// Check if command exists
function commandExists(command) {
    return new Promise((resolve) => {
       const testProcess = spawn('which', [command], { stdio: 'pipe' });
       testProcess.on('close', (code) => {
           resolve(code === 0);
       });
       testProcess.on('error', () => {
           resolve(false);
       });
    });
}

//Prepare COMMANDS LIST
async function prepareAvailableCommands() {
    const commands = {};
    await new Promise(resolve => {
        var counter = 0;
        _.each(COMMANDS.LANGUAGES, async function(conf, key) {
            COMMANDS.LANGUAGES[key].enabled = await commandExists(conf.command);
            commands[key] = COMMANDS.LANGUAGES[key].enabled;
            counter++;

            if(counter>=Object.keys(COMMANDS.LANGUAGES).length) {
                resolve();
            }
        });
    })
    COMMANDS.CMDLIST = commands;
    return commands;
}

// Language configurations
async function getLanguageConfigs() {
    return COMMANDS.LANGUAGES;
}

// Get available commands
async function getAvailableCommands() {
   return COMMANDS.CMDLIST;
}

// Get available templates
async function getAvailableTemplates() {
    return COMMANDS.TEMPLATES;
}

// Get list of available scripts
async function getAvailableScripts(RELOAD) {
    if(!SCRIPTS || RELOAD===true) {
        SCRIPTS = {}; // reset

        if(fsSync.existsSync('./scripts/')) {
            const folders = await fs.readdir("./scripts/");

            for (const folder of folders) {
                if(folder.charAt(0)==".") continue;

                const dirPath = `./scripts/${folder}/`;
                const files = await fs.readdir(dirPath);

                SCRIPTS[folder] = {};
                
                for (const file of files) {
                    if(file.charAt(0)==".") continue;

                    SCRIPTS[folder][file] = `./scripts/${folder}/${file}`;
                }
            }
        }
    }
    return SCRIPTS;
}

// Get Script Content
async function getScriptContent(language, fileCode) {
    if(SCRIPTS[language] && SCRIPTS[language][fileCode]) {
        const code = fs.readFile(SCRIPTS[language][fileCode], "utf8");
        return code;
    }
    return "";
}

// Dangerous patterns to check in code
const DANGEROUS_PATTERNS = [
   /require\s*\(\s*['"`]fs['"`]\s*\)/gi,
   /require\s*\(\s*['"`]child_process['"`]\s*\)/gi,
   /require\s*\(\s*['"`]os['"`]\s*\)/gi,
   /require\s*\(\s*['"`]path['"`]\s*\)/gi,
   /require\s*\(\s*['"`]process['"`]\s*\)/gi,
   /import.*from\s*['"`]fs['"`]/gi,
   /import.*from\s*['"`]child_process['"`]/gi,
   /import.*from\s*['"`]os['"`]/gi,
   /import.*from\s*['"`]path['"`]/gi,
   /import.*from\s*['"`]process['"`]/gi,
   /exec\s*\(/gi,
   /spawn\s*\(/gi,
   /system\s*\(/gi,
   /eval\s*\(/gi,
   /Function\s*\(/gi,
   /\.\.\/|\.\.\\|\.\.\//gi,
   /\/etc\/|\/bin\/|\/usr\/|\/var\/|\/tmp\//gi,
   /C:\\Windows|C:\\Program Files/gi,
   /rm\s+\-rf|del\s+\/|format\s+/gi,
   /sudo\s+|su\s+/gi,
   /curl\s+|wget\s+|fetch\s+/gi,
   /socket\s*\(/gi,
   /net\.|http\.|https\./gi,
   /process\.exit|process\.kill/gi,
   /open\s*\(/gi,
   /file\s*\(/gi,
   /write\s*\(/gi,
   /delete\s*\(/gi,
   /unlink\s*\(/gi,
   /mkdir\s*\(/gi,
   /rmdir\s*\(/gi
];

// Validate code for dangerous patterns
function validateCode(code) {
   for (const pattern of DANGEROUS_PATTERNS) {
       if (pattern.test(code)) {
           return false;
       }
   }
   return true;
}

// Sanitize file path to ensure it's within temp directory
function sanitizePath(filePath) {
   const resolvedPath = path.resolve(filePath);
   const resolvedTempDir = path.resolve(TEMP_DIR);
   
   if (!resolvedPath.startsWith(resolvedTempDir)) {
       throw new Error('Path traversal attempt detected');
   }
   
   return resolvedPath;
}

// Execute code with timeout and sandboxing
async function executeCode(language, code, input = '') {
   const LANGUAGES = await getLanguageConfigs();
   const config = LANGUAGES[language];
   
   if (!config) {
       throw new Error(`Unsupported language: ${language}`);
   }

   // Validate code for dangerous patterns
   if (!validateCode(code)) {
       throw new Error('Code contains potentially dangerous operations');
   }

   // Limit input size
   if (input.length > 1000) {
       throw new Error('Input too large');
   }

   // Limit code size
   if (code.length > 50000) {
       throw new Error('Code too large');
   }

   const id = uuidv4();
   const fileName = `${id}${config.extension}`;
   const filePath = sanitizePath(path.join(TEMP_DIR, fileName));

   try {
       // Write code to file
       await fs.writeFile(filePath, code);

       let output = '';
       let error = '';

       if (config.compileFirst) {
           // Compile first
           const compileResult = await runCommand(
               config.command,
               [...(config.compileArgs || []), fileName],
               TEMP_DIR,
               '',
               config.timeout
           );

           if (compileResult.error) {
               return {
                   success: false,
                   output: compileResult.output,
                   error: compileResult.error,
                   executionTime: compileResult.executionTime
               };
           }

           // Run compiled code
           const runResult = await runCommand(
               config.runCommand,
               [...(config.runArgs || []), ...(language === 'java' ? [path.basename(fileName, '.java')] : [])],
               TEMP_DIR,
               input,
               config.timeout
           );

           output = runResult.output;
           error = runResult.error;
       } else {
           // Direct execution
           const result = await runCommand(
               config.command,
               [...(config.args || []), fileName],
               TEMP_DIR,
               input,
               config.timeout
           );

           output = result.output;
           error = result.error;
       }

       return {
           success: !error,
           output: output || 'Code executed successfully (no output)',
           error: error,
           executionTime: Date.now()
       };

   } catch (err) {
       return {
           success: false,
           output: '',
           error: err.message,
           executionTime: Date.now()
       };
   } finally {
       // Cleanup
       try {
           await fs.unlink(filePath);
           // Clean up compiled files
           if (config.compileFirst) {
               const executablePath = sanitizePath(path.join(TEMP_DIR, 'a.out'));
               try {
                   await fs.unlink(executablePath);
               } catch {}
               
               if (language === 'java') {
                   const classFile = sanitizePath(path.join(TEMP_DIR, `${path.basename(fileName, '.java')}.class`));
                   try {
                       await fs.unlink(classFile);
                   } catch {}
               }
           }
       } catch {}
   }
}

// Run command with timeout and security restrictions
function runCommand(command, args, cwd, input, timeout) {
   return new Promise((resolve) => {
       const startTime = Date.now();
       
       // Ensure working directory is safe
       const safeCwd = sanitizePath(cwd);
       
       try {
           const childProcess = spawn(command, args, {
               cwd: safeCwd,
               stdio: ['pipe', 'pipe', 'pipe'],
               timeout,
               env: {
                   PATH: process.env.PATH,
                   HOME: process.env.HOME
               },
               uid: process.getuid ? process.getuid() : undefined,
               gid: process.getgid ? process.getgid() : undefined,
               detached: false
           });

           let output = '';
           let error = '';
           let outputSize = 0;
           let errorSize = 0;
           const MAX_OUTPUT_SIZE = 10000;

           childProcess.stdout.on('data', (data) => {
               outputSize += data.length;
               if (outputSize > MAX_OUTPUT_SIZE) {
                   childProcess.kill('SIGKILL');
                   error = 'Output size limit exceeded';
                   return;
               }
               output += data.toString();
           });

           childProcess.stderr.on('data', (data) => {
               errorSize += data.length;
               if (errorSize > MAX_OUTPUT_SIZE) {
                   childProcess.kill('SIGKILL');
                   error = 'Error output size limit exceeded';
                   return;
               }
               error += data.toString();
           });

           // Send input if provided
           if (input) {
               try {
                   childProcess.stdin.write(input);
                   childProcess.stdin.end();
               } catch {
                   childProcess.stdin.end();
               }
           } else {
               childProcess.stdin.end();
           }

           childProcess.on('close', (code) => {
               const executionTime = Date.now() - startTime;
               resolve({
                   output: output.trim().substring(0, MAX_OUTPUT_SIZE),
                   error: error.trim().substring(0, MAX_OUTPUT_SIZE),
                   exitCode: code,
                   executionTime
               });
           });

           childProcess.on('error', (err) => {
               const executionTime = Date.now() - startTime;
               resolve({
                   output: '',
                   error: `Command execution failed: ${err.message}`,
                   exitCode: 1,
                   executionTime
               });
           });

           // Kill process if it takes too long
           const timeoutId = setTimeout(() => {
               if (!childProcess.killed) {
                   childProcess.kill('SIGKILL');
                   resolve({
                       output: '',
                       error: 'Execution timeout',
                       exitCode: 1,
                       executionTime: timeout
                   });
               }
           }, timeout);

           childProcess.on('close', () => {
               clearTimeout(timeoutId);
           });

       } catch (spawnError) {
           const executionTime = Date.now() - startTime;
           resolve({
               output: '',
               error: `Failed to execute command: ${spawnError.message}`,
               exitCode: 1,
               executionTime
           });
       }
   });
}

// Routes
app.post('/api/execute', async (req, res) => {
   try {
       const { language, code, input } = req.body;

       if (!language || !code) {
           return res.status(400).json({
               success: false,
               error: 'Language and code are required'
           });
       }

       const result = await executeCode(language, code, input);
       res.json(result);

   } catch (error) {
       res.status(500).json({
           success: false,
           error: error.message
       });
   }
});

app.get('/api/languages', async (req, res) => {
   try {
       const LANGUAGES = await getLanguageConfigs();
       const TEMPLATES = await getAvailableTemplates();
       const languages = Object.keys(LANGUAGES).map(key => ({
           id: key,
           name: key.charAt(0).toUpperCase() + key.slice(1),
           extension: LANGUAGES[key].extension
       }));
       res.json({
           success: true,
           languages: languages,
           templates: TEMPLATES
       });
   } catch (error) {
       res.status(500).json({
           success: false,
           error: 'Failed to get available languages'
       });
   }
});

app.get('/api/scripts', async (req, res) => {
    try {
        const availableScripts = await getAvailableScripts();
        
        var scripts = [];
        if(availableScripts[req.query.language]) scripts = Object.keys(availableScripts[req.query.language]);

        res.json({
           success: true,
           scripts: scripts
       });
    } catch (error) {
       res.status(500).json({
           success: false,
           error: 'Failed to get available languages'
       });
   }
});

app.post('/api/scripts', async (req, res) => {
    //req.body.language
    //req.body.filecode
    try {
        var code = await getScriptContent(req.body.language, req.body.filecode);
        
        res.json({
           success: true,
           language: req.body.language,
           filecode: req.body.filecode,
           code: code
       });
    } catch (error) {
       res.status(500).json({
           success: false,
           error: 'Failed to get available languages'
       });
   }
});

app.post('/api/scripts/save', async (req, res) => {
    //req.body.language
    //req.body.filecode
    //req.body.code
    try {
        const LANGUAGES = await getLanguageConfigs();
        var extension = LANGUAGES[req.body.language].extension;
        var targetFolder = `./scripts/${req.body.language}/`;
        var targetFile = `./scripts/${req.body.language}/${req.body.filecode}${extension}`;

        if(fsSync.existsSync(targetFile)) {
            res.status(500).json({
               success: false,
               error: 'File with this name already exists, try other name'
           });
            return;
        }

        if(fsSync.existsSync('./scripts/')) {
            try {
                if(!fsSync.existsSync(targetFolder)) await fs.mkdir(targetFolder);
            } catch (err) {
                console.error(err);
            }

            await fs.writeFile(targetFile, decodeURIComponent(req.body.code), 'utf8');
            var availableScripts = await getAvailableScripts(true);

            res.json({
               success: true,
               scripts: Object.keys(availableScripts[req.body.language]?availableScripts[req.body.language]:{})
            });    
        } else {
            res.status(500).json({
               success: false,
               error: 'Failed to create required folder (2)'
           });
        }
    } catch (error) {
        console.error(error);
       res.status(500).json({
           success: false,
           error: 'Error finding required folder (1)'
       });
   }
});

app.get('/', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
async function startServer() {
   await ensureTempDir();
   const availableCommands = await prepareAvailableCommands();
   const availableScripts = await getAvailableScripts();

   console.log('Available commands:', availableCommands);
   // console.log('Available scripts:', availableScripts);

   app.listen(PORT, () => {
       console.log(`Code Editor Server running on http://localhost:${PORT}`);
   });
}

startServer().catch(console.error);