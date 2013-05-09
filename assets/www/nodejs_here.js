if (typeof WScript !== "undefined") {
	var WshShell = new ActiveXObject("WScript.Shell");
	var rval = WshShell.Run('cmd /k "C:\\Program Files\\nodejs\\node.exe" nodejs_here.js');
	WScript.quit();
}

var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

http.createServer(function (req, res) {
	var reqpath = url.parse(req.url).pathname;
	var seg = reqpath.split('/');
	
	if (seg.length <= 1) {
		console.log('Request for ' + reqpath);
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end('<a href="/test/">test</a>\n');
	}
	else {
		var root = seg[1];
		if (root == "test") {
			reqpath = seg.slice(2).join('/');
			if (reqpath == '')
				reqpath = 'index.html';
			fs.exists(reqpath, function(exists) {
				if (!exists) {
					res.writeHeader(404, {"Content-Type": "text/plain"});
					res.write("404 Not Found\n");
					res.end();
				}
				else {
					fs.readFile(reqpath, "binary", function(err, file) {
						if (err) {
							res.writeHeader(500, {"Content-Type": "text/plain"});
							res.write(err + "\n");
							res.end();
						}
						else {
							if (reqpath.endsWith(".html"))
								contentType = "text/html";
							else if (reqpath.endsWith(".gif"))
								contentType = "image/gif";
							else if (reqpath.endsWith(".svg"))
								contentType = "image/svg+xml";
							else if (reqpath.endsWith(".png"))
								contentType = "image/png";
							else if (reqpath.endsWith(".css"))
								contentType = "text/css";
							else if (reqpath.endsWith(".js"))
								contentType = "text/javascript";
							else if (reqpath.endsWith(".xml"))
								contentType = "text/xml";
							else
								contentType = "application/x-octet-stream";
							res.writeHeader(200, {"Content-Type": contentType});
							res.write(file, "binary");
							res.end();
						}
					});
				}
			});
		}
	}
}).listen(8890, '0.0.0.0');

console.log('Server running http://0.0.0.0:8890/');