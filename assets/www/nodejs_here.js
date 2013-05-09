if (typeof WScript !== "undefined") {
	var WshShell = new ActiveXObject("WScript.Shell");
	var rval = WshShell.Run('cmd /k "C:\\Program Files\\nodejs\\node.exe" nodejs_here.js');
	WScript.quit();
}

var http = require('http');

http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('Hello\n');
}).listen(8890, '0.0.0.0');

console.log('Server running http://0.0.0.0:8890/');