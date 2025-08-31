# myCoder - Powerfull Sandboxed Code Editor on Fly

A powerful web-based code editor with sandboxed execution environment supporting multiple programming languages.

## Features

- **Multi-language Support**: JavaScript, Python, Java, C++, C
- **Real-time Code Execution**: Run code directly in the browser
- **Sandboxed Environment**: Safe code execution with timeouts
- **Split Interface**: Code editor on the left, output on the right
- **Syntax Highlighting**: Clean, dark theme similar to VS Code
- **Line Numbers**: Visual line numbering for better code navigation
- **Input Support**: Provide input for programs that require user input
- **Boilerplate Templates**: Quick start with common code patterns
- **Keyboard Shortcuts**: Ctrl+Enter to run code, Tab for indentation

## Prerequisites

Make sure you have the following installed on your system:

- **Node.js** (v14 or higher)
- **npm** (comes with Node.js)
- **Python 3** (for Python code execution)
- **Java JDK** (for Java code execution)
- **GCC/G++** (for C/C++ code execution)

### Installing Prerequisites

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install nodejs npm python3 openjdk-17-jdk gcc g++
```

#### macOS:
```bash
# Install Homebrew if you haven't already
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required packages
brew install node python3 openjdk gcc
```

#### Windows:
1. Download and install Node.js from [nodejs.org](https://nodejs.org/)
2. Download and install Python from [python.org](https://python.org/)
3. Download and install Java JDK from [Oracle](https://www.oracle.com/java/technologies/downloads/)
4. Install MinGW or Visual Studio Build Tools for C/C++ support

## Installation

1. **Clone or create the project directory:**
```bash
mkdir code-editor-app
cd code-editor-app
```

2. **Create the required files:**
   - Copy the `server.js` code into a file named `server.js`
   - Copy the `package.json` content into a file named `package.json`
   - Create a `public` directory and copy the HTML code into `public/index.html`

3. **Install dependencies:**
```bash
npm install
```

## Usage

1. **Start the server:**
```bash
npm start
```

2. **Open your browser and navigate to:**
```
http://localhost:3000
```

3. **Start coding:**
   - Select your preferred programming language from the dropdown
   - Write your code in the left panel
   - Provide input (if needed) in the input section
   - Click "Run" or press Ctrl+Enter to execute
   - View the output in the right panel

## Development

For development with auto-restart on file changes:

```bash
npm install -g pm2
npm run dev
```

## Docker Support

You can also run the application using Docker:

1. **Build the Docker image:**
```bash
docker build -t code-editor-app .
```

2. **Run the container:**
```bash
docker run -p 3000:3000 code-editor-app
```

## API Endpoints

### POST /api/execute
Execute code in the specified language.

**Request Body:**
```json
{
  "language": "javascript",
  "code": "console.log('Hello, World!');",
  "input": "optional input string"
}
```

**Response:**
```json
{
  "success": true,
  "output": "Hello, World!",
  "error": "",
  "executionTime": 45
}
```

### GET /api/languages
Get list of supported languages.

**Response:**
```json
{
   "languages": [
     {
       "id": "javascript",
       "name": "JavaScript",
       "extension": ".js"
     },
     {
       "id": "python",
       "name": "Python",
       "extension": ".py"
     }
   ],
   "templates": {}
}
```

## Security Features

- **Execution Timeout**: Code execution is limited to prevent infinite loops
- **Sandboxed Environment**: Code runs in isolated processes
- **File Cleanup**: Temporary files are automatically cleaned up
- **Resource Limits**: Memory and CPU usage limitations
- **Input Validation**: All inputs are validated before execution

## Supported Languages

| Language | File Extension | Compiler/Interpreter |
|----------|----------------|---------------------|
| JavaScript | .js | Node.js |
| Python | .py | Python 3 |
| Java | .java | OpenJDK |
| C++ | .cpp | G++ |
| C | .c | GCC |

## Troubleshooting

### Common Issues

1. **"Command not found" errors:**
   - Ensure all required compilers/interpreters are installed
   - Check that they're accessible from the command line

2. **Permission errors:**
   - Make sure the application has write permissions to the temp directory
   - On Unix systems, you might need to adjust file permissions

3. **Execution timeouts:**
   - The default timeout is 10-15 seconds
   - Modify the timeout values in `server.js` if needed

4. **Port already in use:**
   - Change the PORT environment variable: `PORT=3001 npm start`

### Performance Tips

- The application creates temporary files for each execution
- Regular cleanup of the temp directory is handled automatically
- For high-traffic usage, consider implementing a queue system
- Monitor disk space as temporary files are created during execution

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Future Enhancements

- [ ] Multiple file support
- [ ] Package/library installation
- [ ] Collaborative editing
- [ ] Code sharing functionality
- [ ] Custom themes
- [ ] More language support (Go, Rust, etc.)
- [ ] Advanced debugging features
- [ ] Code formatting and linting
- [ ] File upload/download
- [ ] Version control integration