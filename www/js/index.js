(function(){
"use strict";
var ON_DEVICE = document.URL.indexOf('http://') === -1;
var API_VERSION = "1";
var API_NAME = "MobileTechnician";

function ViewModel() {
	var model = this;
	model.config = {
		fromserver: false,
		custsvcphone: 'tel:859-448-9730',
		imgcapturequality: 40,
		imgcapturewidth: 1080,
		imgcaptureheight: 1080,
		server: 'http://webservices.divisionsinc.com/' + API_NAME + '_v' + API_VERSION + '.svc',
	};
	this.locations = ko.observableArray();
	this.filter = ko.observable('');
	this.authRequest = {
		company: ko.observable(),
		login: ko.observable(),
		password: ko.observable(''),
		status: ko.observable('need login'),
	};
	this.authRequest.prompt = ko.computed(function() {
		if (this.status() == 'need pin')
			return 'Enter your pin';
		else if (this.status() == 'change pin')
			return 'Please enter a new pin';
		else if (this.status() == 'confirm pin')
			return 'Please confirm your new pin';
	}, this.authRequest);

	this.authToken = ko.observable();
	this.authStatus = ko.observable();
	this.selectionStack = [];
	this.currentLocation = ko.observable();
	this.currentItem = ko.observable();
	this.overallStatus = ko.computed(function() {
		var locs = this.locations();
		if (!locs || locs.length === 0)
			return '';
		for (var i = 0; i < locs.length; i++) {
			var loc = locs[i];
			if (loc.status() === 'checkedin')
				return 'checkedin';
		}
		return '';
	}, model);
	this.syncStatus = ko.observable('ok');
	this.locationSorters = [
		{ id: 'cust', text: 'sort by customer', func: function(a,b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); }},
		{ id: 'dist', text: 'sort by distance', func: function(a,b) { return a.dist() == b.dist() ? 0 : (a.dist() < b.dist() ? -1 : 1); }},
	];
	this.currentSorter = ko.observable('dist');
	this.searchText = ko.observable('');
	this.noteDraft = ko.observable('');
	this.editingNote = ko.observable(false);
	this.sendingNote = ko.observable(false);
	this.initializing = ko.observable(true);
	this.appwait = ko.computed(function() {
		return model.initializing() || model.authRequest.status() == 'requested';
	});
	this.rightNow = function() { return (new Date().getTime() / 1000); }

	this.setConfig = function(name, val, fromdb) {
		if (fromdb && model.serverConfigLoaded && name in model.config)
			return;
		console.log((fromdb ? '[d]' : '[w]') + name + ' = ' + val);
		model.config[name] = val;
		if (name === 'lastlogin')
			model.authRequest.login(val);
		if (name == 'lastcompanyid')
			model.authRequest.company(val);
		if (!fromdb)
			this.saveConfig(name, val);
	};

	this.saveConfig = function(name, val) {
		var db = model.db();
		db.transaction(
			function(tx) {
				tx.executeSql('INSERT OR REPLACE INTO CONFIG (configname, configval) VALUES (?, ?)', [name, JSON.stringify(val)]);
			},
			function(err) {
				console.log("db store save config value failed: " + err);
			}
		);
	};

	this.getConfig = function(name) {
		return model.config[name];
	};

	this.requestConfig = function(oncomplete) {
		// go ahead and start the load from the database
		var db = model.db();
		var dbwait = true;
		var getwait = true;
		var complete = function() {
			if (dbwait || getwait)
				return;
			oncomplete();
		}
		db.transaction(
			function(tx) {
				tx.executeSql('SELECT configname, configval FROM CONFIG', [],
					function(tx, results) {
						for (var i = 0; i < results.rows.length; i++) {
							var item = results.rows.item(i);
							model.setConfig(item.configname, JSON.parse(item.configval), true);
						}
						dbwait = false;
						complete();
					},
					function(err) {
						console.log("db store config read failed: " + err);
						dbwait = false;
						complete();
					}
				);
			},
			function(err) {
				console.log("db store config read tx failed: " + err);
				dbwait = false;
				complete();
			},
			function() {
			}
		);
		// also call out to the web service
		var d = window.device;
		if (!d)
			d = { platform: 'unknown', version: '0' };
		model.get({
			//url: ON_DEVICE ? 'http://mydivisions.com/js/inposition.js' : model.serverUrl('/config'), 
			path: '/config',
			noToken: true, 
			payload: { platform: d.platform, version: d.version},
			success: function(payload) {
				model.serverConfigLoaded = true;
				model.setConfig('fromserver', true, false);
				if (payload && payload.config)
					for (var i = 0; i < payload.config.length; i++)
						model.setConfig(payload.config[i].name, payload.config[i].value, false);
				getwait = false;
				complete();
			},
			error: function(jqXHR, textStatus, e) {
				console.log("WARNING: unable to get updated config from server: " + textStatus);
				getwait = false;
				complete();
			},
		})
	};

	this.doSync = function() {
		if (model.authToken() && model.authToken.expires < model.rightNow())
			model.authToken(false);
		if (!model.authToken())
			return;
		model.itemManager.sendSyncRequest();
	};
	
	this.logout = function() {
		model.authToken(false);
		model.authRequest.status('need login');
		var db = model.db();
		db.transaction(
			function(tx) {
				tx.executeSql('DELETE FROM TOKEN', [],
					function(tx, results) {
					},
					function(err) {
						console.log("db store auth data failed: " + err);
					}
				);
			},
			function(err) {
				console.log("db store auth data failed: " + JSON.stringify(err));
			},
			function() {
			}
		);
	};

	this.serverUrl = function(relpath) {
		if (!ON_DEVICE)
			return '/test/webservice/' + API_NAME + '_v' + API_VERSION + '.svc',
		return model.getConfig('server') + relpath;
	}

	this.get = function(options) {
		options.method = 'GET';
		return model.request(options);
	}

	this.post = function(options) {
		options.method = 'POST';
		return model.request(options);
	}

	this.request = function(options) {
		var event = "POST[" + options.path + "]"; 
		console.log(event);
		try {
			var $req = $.ajax({
				type: options.method,
				url: options.url || model.serverUrl(((!model.authToken() || options.noToken) ? '' : '/' + model.authToken().token) + options.path),
				contentType: 'application/json; charset=UTF-8',
				dataType: 'json',
				data: options.payload ? JSON.stringify(options.payload) : null,
				success: function(a,b) { console.log(event + " success"); options.success(a,b); },
				error: function(a,b,c) { console.log(event + " error " + b); options.error(a,b,c); },
				timeout: options.timeout || 30000,
			});
		}
		catch (e) {
			console.log(event + " exception " + e);
			options.error(null, null, e);
		}
		
	};

	this.postPinChange = function(onsuccess, onfail) {
		model.authRequest.status('requested');
		var spec = model.parseCompany(model.authRequest.company());
		model.post({
			path: '/changepass/' + spec.company + '/' + model.authRequest.login(),
			payload: { newpass: model.pinCandidate, oldpass: model.authRequest.password() },
			success: function(response) {
				if (response.errors)
					return onfail(null, response.errors[0], null);
				model.authRequest.status('ready');
				model.authRequest.password(model.pinCandidate);
				delete model.pinCandidate;
				onsuccess();
			},
			error: function(jqXHR, textStatus, e) {
				onfail(jqXHR, textStatus, e);
			},
		})
	}

	this.postSync = function(hashes, onsuccess, onfail) {
		model.syncStatus('waiting');
		model.post({
			path: '/items/sync',
			payload: { hashes: hashes },
			success: function(response) {
				model.syncStatus('ok');
				model.receiveSync(response);
				if (onsuccess)
					onsuccess(response);
			},
			error: function(jqXHR, textStatus) {
				model.syncStatus('error');
			},
		});
	};

	this.postNote = function(item, note, onsuccess, onfail) {
		model.post({
			path: '/items/' + item.typeid + '/' + item.id + '/notes',
			payload: { note: note },
			success: onsuccess,
			error: onfail,
		});
	};

	this.postCheckin = function(item, onsuccess, onfail) {
		return model.postStatus(item, 'checkedin', onsuccess, onfail);
	};

	this.postStatus = function(item, status, onsuccess, onfail) {
		var position = model.lastPosition();
		model.post({
			path: '/items/' + item.typeid + '/' + item.id + '/status',
			payload: { hash: item.hash, newStatus: status, latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy },
			success: function(syncData) {
				model.receiveSync(syncData);
				if (syncData.errors && syncData.errors.length)
					onfail(null, syncData.errors[0], null);
				else
					onsuccess(syncData);
			},
			error: onfail,
		});
	};

	// User protocol to enter test mode is to prefix the company with a server and a URL
	this.parseCompany = function(company) {
		var server;
		if (company.indexOf('/') !== -1) {
			var divider = company.indexOf('/');
			var host = company.substring(0, divider);
			company = company.substring(divider + 1, company.length);
			server = 'http://' + host + '/' + API_NAME + '_v' + API_VERSION + '.svc';
		}
		return {company: company, server: server};
	}

	this.postLogin = function(auth, data, onsuccess, onfail) {
		// allow user to specify test mode
		var spec = model.parseCompany(auth.company());
		var company = spec.company;
		if (spec.server)
			model.config.server = spec.server;
		var login = auth.login();
		var password = auth.password();
		auth.status('requested');
		model.post({
			noToken: true,
			path: '/auth/' + company + '/' + login,
			payload: {password: password, data: data},
			success: function(response) {
				var authStatus = response.status.split(/ /);
				if (authStatus.indexOf("Authorized") != -1) {
					var finalAuth = function() { 
						auth.status('ready');
						model.onAuthenticated(response.token, expiry);
						onsuccess(response.token, expiry);
					};
					var expiry = Math.round(parseFloat(response.expires)) + Math.round((new Date().getTime() / 1000));
					console.log("Received token: " + response.token + " expires in: " + response.expires + ": absolute: " + expiry);
					if (authStatus.indexOf('PinChangeRequired') != -1) {
						auth.status('change pin');
						model.prompt('Please create a new pin for ' + auth.login());
						model.onpinchange = finalAuth;
					}
					else {
						finalAuth();
					}
				}
				else {
					auth.status('need pin');
					if (authStatus[0] == "Unauthorized")
						onfail("Authorization failed, please try again");
					else
						onfail(response.status);
				}
			},
			error: function(jqXHR, textStatus, e) {
				auth.status('need pin');
				if (textStatus == "error")
					onfail("There was an unexpected problem processing this login request.  Please try again");
				else if (textStatus == "timeout")
					onfail("Unable to reach the server, please check your signal and data connection and try again.");
				else if (textStatus)
					onfail("There was a problem processing this login request (" + textStatus + ").  Please try again.");
				else
					onfail("There was a problem processing this login request (" + e.message + "). Please try again.");
			},
		});
	};

	this.checkinCurrentItem = function(onsuccess, onfail) {
		model.postStatus(model.currentItem(), 'checkedin', onsuccess, onfail);
	};
	
	this.tryCheckinCurrentItem = function(event) {
		var slider = event.detail.control;
		model.waitForBestPosition(
			function() {
				slider.disableWith("acquiring position...");
			},
			function() {
				slider.disableWith("Checking in...");
				var success = function() {
					slider.enable();
					slider.direction(-event.detail.direction);
				}
				var fail = function() {
					slider.disableWith("Checkin failed");
					model.prompt('There was a problem encountered while trying to checkin.  Please check your signal and data connection and try again', 'Notice', 'OK');
					slider.direction(event.detail.direction);
					slider.enable();
				}
				model.checkinCurrentItem(success, fail)
			});
	}
	
	this.checkoutCurrentItem = function(status, onsuccess, onfail) {
		model.postStatus(model.currentItem(), status, onsuccess, onfail);
	};

	this.waitForBestPosition = function waitForBestPosition(ifwait, oncomplete, since) {
		if (arguments.length < 3)
			since = new Date().getTime();
		var waited = new Date().getTime() - since;
		if (waited > 15000) {
			oncomplete();
			return;
		}
		var p = model.lastPosition();
		var age = new Date().getTime() - p.at;
		var adequate = age < 60000 && p.accuracy < 60;
		if (adequate) {
			oncomplete();
			return;
		}
		if (ifwait)
			ifwait(); // give the caller a chance to react to wait
		// check again in 2 seconds
		setTimeout(function() {
			waitForBestPosition(null, oncomplete, since);
		}, 2000);
	};

	this.tryCheckoutCurrentItem = function(event) {
		var slider = event.detail.control;
		var statuses = ['closed', 'reqauth', 'reqfollowup'];
		var status = statuses[event.detail.option.index];

		// wait a bit for adequate position accuracy
		model.waitForBestPosition(
			function() {
				slider.disableWith("acquiring position...");
			},
			function() {
				slider.disableWith("Checking out...");
				var updateSlider = function() {
					slider.direction(model.currentItem().status() == 'checkedin' ? -1 : 1);
				}
				var success = function(syncData) {
					slider.enable();
					if (model.currentItem().status() == 'reqauth') {
						model.prompt("You will now be connected to Divisions customer service by phone to provide additional information.", 'Checkout', 'Continue', function() {
							model.callCustService();
						});
					}
					else if (model.currentItem().status() == 'reqfollowup') {
						model.prompt("You will now be connected to Divisions customer service by phone to provide additional information.", 'Checkout', 'Continue', function() {
							model.callCustService();
						});
					}
					updateSlider();
				}
				var fail = function(jqXHR, textStatus, e) {
					slider.disableWith("Checkout failed");
					if (e || textStatus == "timeout")
						textStatus = "Please check your signal and data connection and try again";
					else if (textStatus == "error")
						textStatus = "Unexpected failure, please try again";
					model.prompt('There was a problem encountered while trying to checkout: ' + textStatus, 'Notice', 'OK');
					slider.enable();
					updateSlider();
				}
				model.checkoutCurrentItem(status, success, fail);
			});
	}
	
	this.onAuthenticated = function(token, expires) {
		model.authToken({token: token, expires: expires});
		model.doSync();
		var db = model.db();
		db.transaction(
			function(tx) {
				tx.executeSql('INSERT INTO TOKEN (token, expires) VALUES (?, ?)', [token, expires],
					function(tx, results) {
					},
					function(err) {
						console.log("db store auth data failed: " + err);
					}
				);
			},
			function(err) {
				console.log("db store auth data failed: " + JSON.stringify(err));
			},
			function() {
			}
		);
	};

	this.prompt = function(message, title, button, callback) {
		button = button || "OK";
		title = title || "In Position";
		if (ON_DEVICE)
			navigator.notification.alert(message, callback, title, button);
		else {
			// when not on an actual device, we need to simulate
			// phonegap's alert (which is non-blocking)
			var $div = $('<div class="alert"/>');
			var $title = $('<div class="title"/>');
			$title.text(title);
			var $text = $('<div class="text"/>');
			$text.text(message);
			var $button = $('<button/>');
			$button.text(button);
			$div.append($title).append($text).append($button);
			$(document.body).append($div);
			var y = -($div.height() / 2) + 'px';
			$div.css('margin-top', y);
			$button.on('click', function(e) {
				if (callback)
					callback();
				$div.fadeOut(function() {
					$div.remove();
				});
			});
			$div.fadeIn();
		}
	};

	this.acceptLogin = function() {
		var auth = model.authRequest;

		if (!auth.company()) {
			model.prompt("Please enter a company id", "Login", "OK");
			return;
		}
		
		if (!auth.login()) {
			model.prompt("Please enter a login", "Login", "OK");
			return;
		}
		
		model.authRequest.status('need pin');
	};

	this.cancelPin = function() {
		model.authRequest.status('need login');
	}
	
	this.loginClick = function(e) {
		if (model.authRequest.status() == 'need pin') {
			console.log('LOGIN');
			var auth = model.authRequest;

			console.log(e);
			auth.password(e.detail.pin);
			
			model.setConfig('lastcompanyid', auth.company(), false);
			model.setConfig('lastlogin', auth.login(), false);

			var success = function(token, expires) {
			};
			var fail = function(message) {
				model.prompt(message, 'Login');
			};
			var data = {};
			try {
				if (ON_DEVICE) {
					for (var prop in device)
						data[prop] = device[prop];
				}
				else {
					data.platform = "unknown";
				}
				data.winwidth = $(window).width();
				data.winheight = $(window).height();
				data.scrwidth = screen.width;
				data.scrheight = screen.height;
				data.pixelratio = window.devicePixelRatio;
				data = JSON.stringify(data);
			}
			catch (e) {
				data = '' + e;
			}
			model.postLogin(auth, data, success, fail);
		}
		else if (model.authRequest.status() == 'change pin') {
			model.pinCandidate = e.detail.pin;
			if (['12345','11111','00000'].indexOf(model.pinCandidate) != -1) {
				model.prompt("Sorry, your pin cannot be 12345, 00000, or 11111.  Please try again");
			}
			else {
				model.authRequest.status('confirm pin');
			}
		}
		else if (model.authRequest.status() == 'confirm pin') {
			if (model.pinCandidate != e.detail.pin) {
				model.prompt("The second pin you entered did not match the first.  Please begin again");
				model.authRequest.status('change pin');
			}
			else {
				var success = function() {
					model.onpinchange();
				}
				var failure = function() {
					model.prompt("Changing your pin failed.  Please make sure you have a data connection and try again.");
					model.authRequest.status('change pin');
				}
				model.postPinChange(success, failure);
			}
		}
	};
	
	this.doAppAuth = function(done) {
		var db = model.db();
		var expiry = model.rightNow() + 60;
		db.transaction(
			function(tx) {
				tx.executeSql('DELETE FROM TOKEN WHERE expires <= ?', [expiry]);
				tx.executeSql('SELECT token FROM TOKEN WHERE expires > ? ORDER BY expires DESC', [expiry],
					function(tx, results) {
						done();
						if (results.rows.length > 0) {
							var r = results.rows.item(0);
							model.authToken({token: r.token, expires: r.expires});
							var now = new Date().getTime();
							var recheck = (r.expires * 1000) - now;
							if (recheck <= 0)
								recheck = 1;
							setTimeout(function() {
								model.doAppAuth(function() {});
							}, recheck);
						}
						else {
							model.authToken(false);
						}
					},
					function(err) {
						done();
						console.log("db get auth data failed: " + err);
					}
				);
			},
			function(err) {
				done();
				console.log("db get auth data failed: " + JSON.stringify(err));
			},
			function() {
			}
		);
	};
	
	this.takePic = function() {
		navigator.camera.getPicture(function(filename) {
			var url = '/' + model.token + '/items/' + model.currentItem().typeid + '/' + model.currentItem().id + '/pic';
			var options = new FileUploadOptions();
			options.fileKey = "image";
			options.fileName = filename.substr(filename.lastIndexOf('/') + 1);
			options.mimeType = "image/jpeg";
			options.params = {};
			var deleteFile = function(filename) {
				window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fs) {
					fs.root.remove(filename, function() { console.log("local pic deleted"); }, function(err) { console.log("local pic delete failed: " + err); });
				}, null);
			};
			var success = function(r) {
				console.log("Code = " + r.responseCode);
				console.log("Response = " + r.response);
				console.log("Sent = " + r.bytesSent);
				deleteFile(filename);
			};
			var fail = function(error) {
				model.prompt("Uploading the image has failed: Code = " + error.code, "Photo Upload");
				console.log("upload error source " + error.source);
				console.log("upload error target " + error.target);
				deleteFile(filename);
			};
			var ft = new FileTransfer();
			ft.upload(filename, model.serverUrl(url), success, fail, options);
		},
		function(data) {
		},
		{
			quality: model.config.imgcapturequality, 
			destinationType: Camera.DestinationType.FILE_URI, 
			correctOrientation: true,
			targetWidth: model.config.imgcapturewidth,
			targetHeight: model.config.imgcaptureheight,
		});
	};
	
	this.addNote = function() {
		model.noteDraft('');
		model.editingNote(true);
	};
	
	this.sendNote = function() {
		var note = model.noteDraft();
		if (note !== '') {
			model.sendingNote(true);
			//$notebox.prop('disabled', true);
			var success = function(response) {
				model.sendingNote(false);
				model.noteDraft('');
				model.editingNote(false);
			};
			var fail = function(jqXHR, textStatus, e) {
				model.sendingNote(false);
				model.prompt('There was a problem encountered while sending your note.  Check that you have a signal and a data connection', 'Notice', 'OK');
			};
			model.postNote(model.currentItem(), note, success, fail);
		}
	};
	
	this.cancelNote = function() {
		model.noteDraft('');
		model.editingNote(false);
	};
	
	this.lastPosition = ko.observable(false);
	this.onPositionUpdate = function(position) {
		var c = position.coords;
		var p = model.lastPosition() || {};
		p.longitude = c.longitude;
		p.latitude = c.latitude;
		p.accuracy = c.accuracy;
		p.at = new Date().getTime();
		console.log("Position: " + JSON.stringify(p));
		model.lastPosition(p);
	};

	this.filteredLocations = ko.computed(function() {
		var locs = this.locations.slice().filter(function(l) { return l.matchesFilter(model.searchText()); });
		var sorters = model.locationSorters.filter(function(q) { return q.id == model.currentSorter(); });
		locs.sort(sorters[0].func);
		return locs;
	}, model);
	

	function numberWithCommas(x) {
		var parts = x.toString().split(".");
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		return parts.join(".");
	}
	
	this.myDistanceTo = function(lat, long) {
		var p = model.lastPosition();
		if (!p)
			return -1;
		var x1 = long * Math.PI / 180;
		var y1 = lat * Math.PI / 180;
		var x2 = p.longitude * Math.PI / 180;
		var y2 = p.latitude * Math.PI / 180;
		var dx = x2 - x1;
		var dy = y2 - y1;
		var shdy = Math.sin(dy/2);
		var shdx = Math.sin(dx/2);
		var a = shdy * shdy + shdx * shdx * Math.cos(y1) * Math.cos(y2);
		if (a < 0)
			return -2;
		if (a > 1)
			return -3;
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return 6371000 * c;
	};
	
	this.formatDistance = function(meters) {
		if (meters < 0) {
			var s = '';
			while(meters < 0) {
				meters++;
				s += '?';
			}
			return s;
		}
		if (isNaN(meters))
			return 'E';
		var mi = meters * 0.000621504;
		var m = mi;
		var tenths = Math.floor((mi % 1) * 10);
		mi = "" + Math.floor(mi);
		if (mi.length > 2)
			return numberWithCommas(mi) + ' mi';
		else
			return mi + '.' + tenths + ' mi';
	};
	
	function ItemManager() {
		var mgr = this;
		
		this.itemByHash = {};
		this.itemById = {};
		
		this.sendSyncRequest = function() {
			// Do Sync
			// get hashes for current items
			var hashes = [];
			var locs = model.locations();
			for (var i = 0; i < locs.length; i++) {
				var loc = locs[i];
				var items = loc.items();
				for (var j = 0; j < items.length; j++) {
					var item = items[j];
					hashes.push(item.hash);
				}
			}
			
			console.log("Sending sync request");
			
			model.postSync(hashes);
		};
		
		this.requestDbLoad = function() {
			var db = model.db();
			db.transaction(
				function(tx) {
					tx.executeSql('SELECT data FROM ITEM', [],
						function(tx, results) {
							var syncData = { minus: [], plus: [] };
							for (var i = 0; i < results.rows.length; i++) {
								var item = JSON.parse(results.rows.item(i).data);
								syncData.plus.push(item);
							}
							console.log("database read complete, applying...");
							mgr.sync(syncData);
							console.log("database read application complete");
						},
						function(err) {
							console.log("db get data failed: " + err);
						}
					);
				},
				function(err) {
					
				},
				function() {
					
				}
			);
		};
		
		this.sync = function (syncData) {
			// sync data is in two parts, "minus" and "plus".
			var results = { del: [], upd: [], ins: [] };
			
			// map location hashes to locations
			var locsByLocHash = {};
			for (var i = model.locations().length - 1; i >= 0; i--) {
				var loc = model.locations()[i];
				locsByLocHash[loc.lochash] = loc;
			}
			
			// remove old hashes
			for (var i = 0; i < syncData.minus.length; i++) {
				var hash = syncData.minus[i];
				delete this.itemByHash[hash];
			}
			
			// process new+modified items from sync data
			var plus = syncData.plus;
			for (var i = 0; i < plus.length; i++) {
				var syncItem = plus[i];
				var item;
				if (syncItem.id in this.itemById) {
					// update existing item
					item = this.itemById[syncItem.id];
					model.map(model.maps.item, syncItem, item);
					this.itemByHash[item.hash] = item;
					results.upd.push(syncItem);
					console.log('updated item ' + item.number);
				}
				else {
					// insert new item
					item = {};
					model.map(model.maps.item, syncItem, item);
					this.itemById[syncItem.id] = item;
					this.itemByHash[syncItem.hash] = item;
					results.ins.push(syncItem);
					if (!(item.lochash in locsByLocHash)) {
						model.locations.push(locsByLocHash[item.lochash] = model.createLocation(item));
						console.log('added location ' + locsByLocHash[item.lochash].name);
					}
					var loc = locsByLocHash[item.lochash];
					// add item to its location
					loc.items.push(item);
					console.log('added item ' + item.number + ' with hash ' + syncItem.hash);
				}
			}

			// remove any items whose hash no longer exists
			for (var itemId in this.itemById) {
				var item = this.itemById[itemId];
				if (!(item.hash in this.itemByHash)) {
					delete this.itemById[itemId];
					results.del.push(itemId);
					console.log('removed item ' + item.number + ', ' + item.hash + ' no longer exists');
				}
			}
			
			// also remove them from their locations, and remove empty locations
			for (var i = model.locations().length - 1; i >= 0; i--) {
				var loc = model.locations()[i];
				for (var j = loc.items().length - 1; j >= 0; j--) {
					var item = loc.items()[j];
					if (!(item.hash in this.itemByHash)) {
						loc.items.splice(j, 1);
						console.log('removed item ' + item.number + ' from loc');
						if (loc.items().length === 0) {
							model.locations.splice(i, 1);
							console.log('removed loc ' + loc.name);
						}
					}
				}
			}
			
			return results;
		};
		
		this.updateDb = function(operations) {
			var db = model.db();
			db.transaction(
				function(tx) {
					for (var i = 0; i < operations.ins.length; i++) {
						var item = operations.ins[i];
						tx.executeSql('INSERT OR REPLACE INTO ITEM (id, data) VALUES (?, ?)', [item.id, JSON.stringify(item)]);
					}
					for (var i = 0; i < operations.upd.length; i++) {
						var item = operations.upd[i];
						tx.executeSql('INSERT OR REPLACE INTO ITEM (id, data) VALUES (?, ?)', [item.id, JSON.stringify(item)]);
					}
					for (var i = 0; i < operations.del.length; i++) {
						var id = operations.del[i];
						tx.executeSql('DELETE FROM ITEM WHERE id = ?', [id]);
					}
				},
				function(err) {
					console.log("db transaction failed: " + err);
				},
				function() {
				}
			);
		};
	};

	this.itemManager = new ItemManager();
	
	this.db = function() {
		if (!('dbhandle' in model)) {
			var db = model.dbhandle = window.openDatabase("localstore", "1.0", "Local Store", 1048576);
			db.transaction(function(tx) {
				tx.executeSql('DROP TABLE IF EXISTS PURCHORD');
				tx.executeSql('CREATE TABLE IF NOT EXISTS ITEM (id unique, data)');
				tx.executeSql('CREATE TABLE IF NOT EXISTS TOKEN (token unique, expires)');
				tx.executeSql('CREATE TABLE IF NOT EXISTS CONFIG (configname unique, configval)');
			},
			function(err) {
				console.log("db open failed: " + err);
			},
			function() {
				console.log("db opened");
			});
		}
		return model.dbhandle;
	};
	
	this.receiveSync = function(syncData) {
		console.log("Sync data received");
		var results = model.itemManager.sync(syncData);
		model.itemManager.updateDb(results);
	};
	
	this.createLocation = function(item) {
		var dist = model.myDistanceTo(item.latitude, item.longitude);
		var location = {
			hash: item.lochash,
			name: item.locName,
			address: item.locAddress,
			latitude: item.latitude,
			longitude: item.longitude,
			radius: item.radius,
			items: ko.observableArray(),
		};
		location.dist = ko.computed(function() {
			return model.myDistanceTo(this.latitude, this.longitude)
		}, location);
		location.distance = ko.computed(function() {
			return model.formatDistance(this.dist());
		}, location);
		location.status = ko.computed(function() {
			if (!this.items)
				return 'undefined';
			var items = this.items();
			if (items.length == 1)
				return items[0].status();
			else if (items.length === 0)
				return 'closed';
			// if any item is checked in, then the status is checked in
			// if all are closed, then status is closed
			var closed = true;
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				if (item.status() == 'checkedin')
					return 'checkedin';
			}
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				if (item.status() == 'reqauth')
					return 'reqauth';
			}
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				if (item.status() == 'reqfollowup')
					return 'reqfollowup';
			}
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				if (item.status() != 'closed')
					closed = false;
			}
			if (closed)
				return 'closed';
		}, location);
		location.matchesFilter = function(f) {
			if (typeof f === 'undefined' || f === '')
				return true;
			f = f.toLowerCase();
			for (var i = 0; i < this.items().length; i++) {
				var item = this.items()[i];
				if (item.number.toLowerCase().indexOf(f) != -1)
					return true;
			}
			if (-1 != this.name.toLowerCase().indexOf(f))
				return true;
			if (-1 != this.address.toLowerCase().indexOf(f))
				return true;
			return false;
		};
		return location;
	};
	
	this.refreshLocations = function() {
		model.doSync();
	};

	this.callCustService = function() {
		window.location.href = model.getConfig('custsvcphone');
	}
	
	this.selectLocation = function(location) {
		console.log("Select Location: " + location.name);
		model.currentLocation(location);
		var items = model.currentLocation().items();
		if (items.length == 1)
			model.currentItem(items[0]);
	};
	
	this.checkin = function() {
		model.currentItem().status('checkedin');
		model.currentItem(null);
		var screen = Screens.pop();
	};
	
	this.completeJob = function() {
		model.currentItem().status('closed');
		model.currentItem(null);
		var screen = Screens.pop();
	};
	
	this.incompleteJob = function() {
		model.currentItem().status('incomplete');
		model.currentItem(null);
		var screen = Screens.pop();
	};
	
	this.cancelLocation = function() {
		model.currentLocation(null);
	};

	this.cancelItem = function() {
		model.currentItem(null);
		if (model.currentLocation().items().length == 1)
			model.currentLocation(null);
	}
	
	this.selectItem = function(item) {
		model.currentItem(item);
	};
	
	// map from a javscript object to a model object
	this.map = function(map, jso, modelo) {
		var rules = map.rules;
		var stat = map['static'];
		for (var prop in jso) {
			if (prop in rules) {
				var rule = rules[prop];
				if (typeof(rule) == "function")
					rule.call(modelo, jso[prop]);
				else if (typeof(rule) == "string")
					modelo[rule] = jso[prop];
			}
			else {
				modelo[prop] = jso[prop];
			}
		}
		for (var s in stat) {
			if (!(s in modelo))
				modelo[s] = stat[s];
		}
	};

	this.maps = {
		item: {
			'static': {
				'typeid': 'purchaseorder',
				'typename': 'PO',
			},
			'rules': {
				'status': function (val) { if (!this.status) { this.status = ko.observable(val); } else { this.status(val); }},
			},
		},
	};
}

function switchToPng() {
	style = document.createElement('style');
	$style = $(style);
	$style.attr('type', 'text/css');
	var sss = document.styleSheets;
	var expr = /\/img\/svg\/(.*?)\.svg/g;
	var overrides = '';
	for (var i = 0; i < sss.length; i++) {
		var ss = sss[i];
		for (var j = 0; j < ss.cssRules.length; j++) {
			var rule = ss.cssRules[j];
			var text = rule.cssText;
			if (expr.test(text)) {
				text = text.replace(expr, "/img/gen/$1.png");
				overrides += text + '\n';
			}
		}
	}
	$style.html(overrides);
	$('head').append($style);
}

var init = function() {
	console.log("device ready");
	var model = new ViewModel();

	var startBackground = function() {
		console.log("START BG");
		if (!model.bgsync)
			model.bgsync = setInterval(function() { model.doSync(); }, 900000);
		if (!model.bggps) {
			model.bggps = navigator.geolocation.watchPosition(
				function(position) {
					model.onPositionUpdate(position);
				},
				function() {
					// TODO: add indicator for bad GPS
				},
				{ maximumAge: 180000, enableHighAccuracy: true }
			);
		}
		model.doSync();
	};

	var stopBackground = function() {
		console.log("STOP BG");
		navigator.geolocation.clearWatch(model.bggps);
		delete model.bggps;
		clearInterval(model.bgsync);
		delete model.bgsync;
	};

	var onbackbutton = function() {
		console.log("DEVICE BACK BUTTON");
		if (model.editingNote())
			return model.cancelNote();
		if (model.currentItem())
			return model.cancelItem();
		if (model.currentLocation())
			return model.cancelLocation();
		stopBackground();
		navigator.app.exitApp();
	};

	// detect and handle android 2 (lack of svg)
	model.needPng = 'device' in window && window.device.platform && device.platform.toLowerCase() == 'android' && device.version.substring(0, 1) == '2';
	if (model.needPng)
		switchToPng();
	document.addEventListener('backbutton', onbackbutton, false);
	document.addEventListener('pause', stopBackground, false);
	document.addEventListener('resume', startBackground, false);
	ko.applyBindings(model, document.getElementById('application'));
	function Initialize() {
		var initializer = this;
		this.configStep = function() {
			model.requestConfig(function() {
				if (!model.serverConfigLoaded) {
					model.prompt('Unable to reach server, please make sure you have a signal and a data connection.  Some features may not work correctly', 'No Connection', 'OK', function() {
						if (!model.getConfig('fromserver')) {
							setTimeout(function() { initializer.configStep(); }, 1000);
						}
						initializer.initStep();
					});
					return;
				}
				initializer.initStep();
			})
		};
		this.initStep = function() {
			if (model.authRequest.login() && model.authRequest.company() && model.authRequest.status() == 'need login')
				model.authRequest.status('need pin');
			model.itemManager.requestDbLoad();
			model.doAppAuth(function() { model.initializing(false); });
		};
		this.run = function() {
			initializer.configStep();
		};
	}
	var initializer = new Initialize();
	initializer.run();
	startBackground();
};

if (ON_DEVICE)
	document.addEventListener('deviceready', init, false);
else
	$(document).ready(init);


ko.bindingHandlers.fade = {
	init: function(element, valueAccessor) {
		var visible = ko.utils.unwrapObservable(valueAccessor());
		$(element).css('display', visible ? 'auto' : 'none');
	},
	update: function(element, valueAccessor) {
		var visible = ko.utils.unwrapObservable(valueAccessor());
		if (visible)
			$(element).fadeIn();
		else
			$(element).fadeOut();
	},
};

ko.bindingHandlers.input = {
	init: function(input, valueAccessor) {
		var b = valueAccessor();
		if (ko.isObservable(b) && !b.isComputed)
			$(input).on('input', function() { b(this.value); });
	},
	update: function(input, valueAccessor) {
		var v = ko.utils.unwrapObservable(valueAccessor());
		if (v !== input.value)
			input.value = v;
	},
};

ko.bindingHandlers.Sorter = {
	init: function(element, valueAccessor) {
		var sorter = new Sorter(element);
		var bindings = valueAccessor();
		for (var propname in bindings) {
			var binding = bindings[propname];
			if (ko.isObservable(binding) && !binding.isComputed) {
				sorter.onchange(propname, function(newval) {
					binding(newval);
				});
			}
		}
	},
	update: function(element, valueAccessor) {
		var sorter = $(element).data('control');
		var bindings = valueAccessor();
		for (var propname in bindings) {
			var binding = bindings[propname];
			var val = ko.utils.unwrapObservable(binding);
			if (val !== sorter[propname]())
				sorter[propname](val);
		}
	},
};

ko.bindingHandlers.Slider = {
	init: function(element, valueAccessor) {
		var slider = new Slider(element);
		var bindings = valueAccessor();
		for (var propname in bindings) {
			slider.bind(propname, bindings[propname]);
		}
	},
	update: function(element, valueAccessor) {
		var slider = $(element).data('control');
		var bindings = valueAccessor();
		for (var propname in bindings) {
			var binding = bindings[propname];
			console.log('PROPNAME: ' + propname + ', ' + (typeof binding) + ', ' + (typeof slider));
			var val = ko.utils.unwrapObservable(binding);
			if (typeof slider[propname] === 'function' && val !== slider[propname]())
				slider[propname](val);
		}
	},
}

ko.bindingHandlers.PinKeyPad = {
	init: function(element, valueAccessor) {
		var pkp = new PinKeyPad(element);
		var bindings = valueAccessor();
		for (var propname in bindings) {
			pkp.bind(propname, bindings[propname]);
		}
	},
	update: function(element, valueAccessor) {
		var pkp = $(element).data('control');
		var bindings = valueAccessor();
		for (var propname in bindings) {
			var binding = bindings[propname];
			console.log('PROPNAME: ' + propname + ', ' + (typeof binding) + ', ' + (typeof pkp));
			var val = ko.utils.unwrapObservable(binding);
			if (typeof pkp[propname] === 'function' && val !== pkp[propname]())
				pkp[propname](val);
		}
	},
}

ko.bindingHandlers.iscroll = {
	init: function(element, valueAccessor) {
		var $e = $(element);
		$e.addClass('iscroll');
		$e.height($e.parent().height());
		var control = new iScroll($e.get(0));
		$e.data('control', control);
	},
	update: function(element, valueAccessor) {
		ko.utils.unwrapObservable(valueAccessor());
		var $e = $(element);
		var control = $e.data('control');
		console.log('REFRESHING...' + control);
		setTimeout(function() {
			control.refresh();
		}, 100);
	},
}

}());

