if (typeof WScript !== "undefined") {
	var WshShell = new ActiveXObject("WScript.Shell");
	var rval = WshShell.Run('cmd /k "C:\\Program Files\\nodejs\\node.exe" nodejs_here.js');
	WScript.quit();
}

var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');
var port = 8890;

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
			// strip the leading path segments
			seg = seg.slice(2);
			// handle web service requests
			if (seg.length > 0 && seg[0] == 'webservice') {
				seg = seg.slice(1);
				reqpath = seg.join('/');
				var headers = req.headers;
				headers['host'] = 'localhost:81';
				var proxy_options = {
					hostname: 'localhost',
					port: 82,
					path: '/' + reqpath,
					method: req.method,
					headers: headers
					};
				var proxy_request = http.request(proxy_options, function(proxy_response) {
					proxy_response.on('data', function(chunk) {
						res.write(chunk, 'binary');
					});
					
					proxy_response.on('end', function() {
						res.end();
					});
					
					res.writeHead(proxy_response.statusCode, proxy_response.headers);
				});
				
				proxy_request.on('error', function(e) {
					console.log('problem with request: ' + e.message);
				});
				
				req.on('data', function(chunk) {
					proxy_request.write(chunk, 'binary');
				});
				
				req.on('end', function() {
					proxy_request.end();
				});
			}
			else {
				// assume this is a filesystem request
				reqpath = seg.join('/');
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
		else {
			res.writeHeader(404, {"Content-Type": "text/plain"});
			res.write("404 Not Found, try /test/\n");
			res.end();
		}
	}
}).listen(port);

console.log('Server running on ' + port + '...');