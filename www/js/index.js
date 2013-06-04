var ON_DEVICE = document.URL.indexOf('http://') === -1;

function ViewModel() {
	var model = this; 
	this.locations = ko.observableArray();
	
	this.selectionStack = [];
	this.currentLocation = ko.observable();
	this.currentPo = ko.observable();
	this.overallStatus = ko.computed(function() {
		var locs = this.locations();
		if (!locs || locs.length == 0)
			return '';
		for (var i = 0; i < locs.length; i++) {
			var loc = locs[i];
			if (loc.status() == 'checkedin')
				return 'checkedin';
		}
		return '';
	}, model);
	
	if (ON_DEVICE) {
		this.webserviceRoot = 'http://{host}/ServiceVerificationApp.svc';
	}
	else {
		this.webserviceRoot = '/test/webservice/ServiceVerificationApp.svc';
	}
	
	this.doSync = function() {
		if (model.locations().length == 0)
			model.poManager.requestDbLoad(model.poManager.sendSyncRequest);
		else
			model.poManager.sendSyncRequest();
	}
	
	setInterval(function() { model.doSync(); }, 120000);
	
	this.logout = function() {
		var db = model.db();
		db.transaction(
			function(tx) {
				tx.executeSql('DELETE FROM TOKEN', [],
					function(tx, results) {
					},
					function(err) {
						console.log("db store auth data failed: " + err);
					}
				)
			},
			function(err) {
				console.log("db store auth data failed: " + JSON.stringify(err));
			},
			function() {
			}
		);
		model.doLoginScreen();
	}
	
	this.post = function(options) {
		try {
			$req = $.ajax({
				type: 'POST',
				url: model.webserviceRoot + '/' + model.token + options.path,
				contentType: 'application/json; charset=UTF-8',
				dataType: 'json',
				data: JSON.stringify(options.payload),
				success: options.success,
				error: options.error,
				timeout: options.timeout || 8000,
			});
		}
		catch (e) {
			options.error(null, null, e);
		}
		
	}
	
	this.checkinCurrentPo = function(onsuccess, onfail) {
		model.post({
			path: '/purchaseorders/' + model.currentPo().id + '/status',
			payload: { newStatus: 'checkedin', latitude: model.lastPosition.latitude, longitude: model.lastPosition.longitude, accuracy: model.lastPosition.accuracy },
			success: function(syncData) {
				model.receiveSync(syncData);
				onsuccess(syncData);
			},
			error: function(jqXHR, textStatus, e) {
				onfail(jqXHR, textStatus, e);
			},
		});
	}
	
	this.checkoutCurrentPo = function(onsuccess, onfail) {
		model.post({
			path: '/purchaseorders/' + model.currentPo().id + '/status',
			payload: { newStatus: status, latitude: model.lastPosition.latitude, longitude: model.lastPosition.longitude, accuracy: model.lastPosition.accuracy },
			success: function(syncData) {
				model.receiveSync(syncData);
				onsuccess(syncData);
			},
			error: onfail,
		})
	}
	
	this.onAuthenticate = function(token, expires) {
		model.token = token;
		var db = model.db();
		db.transaction(
			function(tx) {
				tx.executeSql('INSERT INTO TOKEN (token, expires) VALUES (?, ?)', [token, expires],
					function(tx, results) {
					},
					function(err) {
						console.log("db store auth data failed: " + err);
					}
				)
			},
			function(err) {
				console.log("db store auth data failed: " + JSON.stringify(err));
			},
			function() {
			}
		);
	}

	
	this.login = function() {
		var $form = $('#loginform');
		var $logo = $('#loginlogo');
		
		var login = $('#loginbox').val();
		var password = $('#passwordbox').val();
		
		if (login == "") {
			alert("Please enter a login");
			return;
		}
		
		if (password == "") {
			alert("Please enter a password");
			return;
		}

		$form.fadeOut("fast", function() {
			var success = function(token, expires) {
				model.onAuthenticate(token, expires)
				model.doMainActivity();
			}
			var fail = function(message) {
				alert(message);
				$logo.fadeOut("fast", function() {
				});
				$form.css('visibility', 'visible');
				$form.fadeIn();
			}
			var servers = [{host: 'divisionssvr:82', timeout: 1000}, {host: '10.10.11.6:82', timeout: 1000}, {host: '192.168.101.14:82', timeout: 1000}];
			var doAuth = function(list) {
				var server = list[0];
				console.log(server);
				var url = model.webserviceRoot.replace('{host}', server.host) + '/auth/' + login;
				console.log(url);
				var err = function(list, message) {
					if (list.length > 1)
						doAuth(list.splice(1));
					else
						fail(message);
				}
				try {
					$req = $.ajax({
						type: 'POST',
						url: url,
						contentType: 'application/json; charset=UTF-8',
						timeout: server.timeout,
						dataType: 'json',
						data: JSON.stringify({ password: password, data: "" }),
						success: function(data) {
							if (data.status == "Authorized") {
								var expiry = Math.round(parseFloat(data.expires)) + Math.round((new Date().getTime() / 1000));
								console.log("Received token: " + data.token + " expires in: " + data.expires + ": absolute: " + expiry);
								model.webserviceRoot = model.webserviceRoot.replace('{host}', server.host);
								success(data.token, expiry);
							}
							else {
								if (data.status == "Authorization failed")
									fail("Authorization failed, please try again");
								else
									fail(data.status);
							}
						},
						error: function(jqXHR, textStatus) {
							console.log("error: " + textStatus);
							if (textStatus == "error")
								err(list, "There was an unexpected problem processing this login request.  Please try again");
							else if (textStatus == "timeout")
								err(list, "Unable to reach the server, do you have signal and a data connection?");
							else
								err(list, "There was an unexpected problem processing this login request.  Please try again.  (Status = '" + textStatus + "')");
							},
						});
				}
				catch (e) {
					err(list, "There was an unexpected problem processing this login request.  Please try again.  (Problem = '" + e.message + "')");
				}
			}
			doAuth(servers);
		});
		$logo.css('visibility', 'visible');
		$logo.fadeIn();
	}
	
	this.doMainActivity = function() {
		Screens.replace('locations', model);
	}
	
	this.doAppAuth = function() {
		var db = model.db();
		var expiry = (new Date().getTime() / 1000) + 60;
		db.transaction(
			function(tx) {
				tx.executeSql('DELETE FROM TOKEN WHERE expires <= ?', [expiry]);
				tx.executeSql('SELECT token FROM TOKEN WHERE expires > ? ORDER BY expires DESC', [expiry],
					function(tx, results) {
						if (results.rows.length > 0)
							model.token = results.rows.item(0).token;
						if (model.token)
							model.doMainActivity();
						else
							model.doLoginScreen();
						return false;
					},
					function(err) {
						console.log("db get auth data failed: " + err);
						model.doLoginScreen();
					}
				)
			},
			function(err) {
				console.log("db get auth data failed: " + JSON.stringify(err));
				model.doLoginScreen();
			},
			function() {
				
			}
		);
	}
	
	this.doLoginScreen = function() {
		console.log('doLoginScreen');
		Screens.replace('login', model);
	}
	
	this.takePic = function() {
		navigator.camera.getPicture(function(filename) {
			var url = '/' + model.token + '/purchaseorders/' + model.currentPo().id + '/pic';
			alert(filename);
			alert(url);
			var options = new FileUploadOptions();
			options.fileKey = "image";
			options.fileName = filename.substr(filename.lastIndexOf('/') + 1);
			options.mimeType = "image/jpeg";
			options.params = {};
			var success = function(r) {
				console.log("Code = " + r.responseCode);
	            console.log("Response = " + r.response);
	            console.log("Sent = " + r.bytesSent);
			}
			var fail = function(error) {
				alert("An error has occurred: Code = " + error.code);
	            console.log("upload error source " + error.source);
	            console.log("upload error target " + error.target);
			}
			var ft = new FileTransfer();
			ft.upload(filename, model.webserviceRoot + url, success, fail, options);
		},
		function(data) {
		},
		{
			quality: 40, 
			destinationType: Camera.DestinationType.FILE_URI, 
			correctOrientation: true,
			targetWidth: 1080,
			targetHeight: 1080,
		});
	}
	
	this.addNote = function() {
		$noteform = $('#noteform');
		$notebox = $('#notebox');
		$notebox.prop('disabled', false);
		$noteform.fadeIn(function() {
			$notebox.focus();
		});
	}
	
	this.sendNote = function() {
		$noteform = $('#noteform');
		$notebox = $('#notebox');
		var note = $notebox.val();
		if (note != '') {
			$notebox.prop('disabled', true);
			$req = $.ajax({
				type: 'POST',
				url: model.webserviceRoot + '/' + model.token + '/purchaseorders/' + model.currentPo().id + '/notes',
				contentType: 'application/json; charset=UTF-8',
				dataType: 'json',
				data: JSON.stringify({ note: note }),
				success: function(data) {
					$noteform.fadeOut();
					$notebox.val('');
					},
				error: function(jqXHR, textStatus) {
					// TODO: probably the wrong status here... don't know if we even get here on connection failure
					alert('There was a problem encountered while sending your note.  Check that you have a signal and a data connection');
					$notebox.prop('disabled', false);
					$notebox.focus();
					},
				});
		}
	}
	
	this.cancelNote = function() {
		$noteform = $('#noteform');
		$noteform.fadeOut(function() {
			$('#notebox').val('');	
		});
	}
	
	this.lastPosition = false;
	this.onPositionUpdate = function(position) {
		var c = position.coords;
		if (!model.lastPosition)
			model.lastPosition = {};
		var p = model.lastPosition;
		if (!ON_DEVICE) {
			c = { latitude: 39.97231, longitude: -104.83427, accuracy: 40.1 };
		}
		p.latitude = c.latitude;
		p.longitude = c.longitude;
		p.accuracy = c.accuracy;
		console.log(c);
		
		for (var i = model.locations().length - 1; i >= 0; i--) {
			var loc = model.locations()[i];
			loc.dist = model.myDistanceTo(loc.latitude, loc.longitude);
			loc.distance(model.formatDistance(loc.dist));
		}
		
		model.sortLocations();
	}
	
	this.locationSorters = {
		'sort_by_cust': function(a,b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); },
		'sort_by_dist': function(a,b) { return a.dist == b.dist ? 0 : (a.dist < b.dist ? -1 : 1); },
	}
	
	this.selectSort = function(sorter) {
		$sortbox = $("#" + sorter);
		$sortbox.addClass("sortbox_current");
		if ('previousSort' in model && model.previousSort != sorter)
			$("#" + model.previousSort).removeClass("sortbox_current");
		model.previousSort = sorter;
		model.currentSorter = model.locationSorters[sorter];
		model.sortLocations();
	}
	
	this.sortLocations = function() {
		model.locations.sort(model.currentSorter);
	}
	
	function numberWithCommas(x) {
	    var parts = x.toString().split(".");
	    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	    return parts.join(".");
	}
	
	this.myDistanceTo = function(lat, long) {
		var p = model.lastPosition;
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
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return 6371000 * c;
	}
	
	this.formatDistance = function(meters) {
		if (meters == -1)
			return '?';
		var mi = meters * 0.000621504;
		var m = mi;
		var tenths = Math.floor((mi % 1) * 10);
		mi = "" + Math.floor(mi);
		if (mi.length > 2)
			return numberWithCommas(mi) + ' mi';
		else
			return mi + '.' + tenths + ' mi';
	}
	
	this.poManager = new function() {
		var mgr = this;
		
		this.poByHash = {};
		this.poById = {};
		
		this.sendSyncRequest = function() {
			// Request PO data
			// TODO: show wait indicator
			
			// Do Sync
			// get hashes for current POs
			var hashes = [];
			var locs = model.locations();
			for (var i = 0; i < locs.length; i++) {
				var loc = locs[i];
				var pos = loc.pos();
				for (var j = 0; j < pos.length; j++) {
					var po = pos[j];
					hashes.push(po.hash);
				}
			}
			
			console.log("Sending sync request");
			
			$req = $.ajax({
				type: 'POST',
				url: model.webserviceRoot + '/' + model.token + '/purchaseorders/sync',
				contentType: 'application/json; charset=UTF-8',
				dataType: 'json',
				data: JSON.stringify({ hashes: hashes }),
				success: function(data) {
						// TODO: hide wait indicator
						model.receiveSync(data);
					},
				error: function(jqXHR, textStatus) {
						// TODO: hide wait indicator
						// TODO: do something about the problem here
					},
				});
		}
		
		this.requestDbLoad = function(oncomplete) {
			var db = model.db();
			db.transaction(
				function(tx) {
					tx.executeSql('SELECT data FROM PURCHORD', [],
						function(tx, results) {
							var syncData = { minus: [], plus: [] };
							for (var i = 0; i < results.rows.length; i++) {
								var po = JSON.parse(results.rows.item(i).data);
								syncData.plus.push(po);
							}
							console.log("database read complete, applying...");
							mgr.sync(syncData);
							console.log("database read application complete");
							if (oncomplete)
								oncomplete();
						},
						function(err) {
							console.log("db get data failed: " + err);
						}
					)
				},
				function(err) {
					
				},
				function() {
					
				}
			);
		}
		
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
				delete this.poByHash[hash];
			}
			
			// process new+modified POs from sync data
			var plus = syncData.plus;
			for (var i = 0; i < plus.length; i++) {
				var syncPo = plus[i];
				if (syncPo.id in this.poById) {
					// update existing PO
					var po = this.poById[syncPo.id];
					model.map(model.maps.po, syncPo, po);
					this.poByHash[po.hash] = po;
					results.upd.push(syncPo);
					console.log('updated po ' + po.number);
				}
				else {
					// insert new PO
					var po = {};
					model.map(model.maps.po, syncPo, po);
					this.poById[syncPo.id] = po;
					this.poByHash[syncPo.hash] = po;
					results.ins.push(syncPo);
					if (!(po.lochash in locsByLocHash)) {
						model.locations.push(locsByLocHash[po.lochash] = model.createLocation(po));
						console.log('added location ' + locsByLocHash[po.lochash].name);
					}
					var loc = locsByLocHash[po.lochash];
					// add PO to its location
					loc.pos.push(po);
					console.log('added po ' + po.number + ' with hash ' + syncPo.hash);
				}
			}

			// remove any POs whose hash no longer exists
			for (var poId in this.poById) {
				var po = this.poById[poId];
				if (!(po.hash in this.poByHash)) {
					delete this.poById[poId];
					results.del.push(poId);
					console.log('removed po ' + po.number + ', ' + po.hash + ' no longer exists');
				}
			}
			
			// also remove them from their locations, and remove empty locations
			for (var i = model.locations().length - 1; i >= 0; i--) {
				var loc = model.locations()[i];
				for (var j = loc.pos().length - 1; j >= 0; j--) {
					var po = loc.pos()[j];
					if (!(po.hash in this.poByHash)) {
						loc.pos.splice(j, 1);
						console.log('removed po ' + po.number + ' from loc');
						if (loc.pos().length == 0) {
							model.locations.splice(i, 1);
							console.log('removed loc ' + loc.name);
						}
					}
				}
			}
			
			model.sortLocations();
			
			return results;
		}
		
		this.updateDb = function(operations) {
			var db = model.db();
			db.transaction(
				function(tx) {
					for (var i = 0; i < operations.ins.length; i++) {
						var po = operations.ins[i];
						tx.executeSql('INSERT OR REPLACE INTO PURCHORD (id, data) VALUES (?, ?)', [po.id, JSON.stringify(po)]);
					}
					for (var i = 0; i < operations.upd.length; i++) {
						var po = operations.upd[i];
						tx.executeSql('INSERT OR REPLACE INTO PURCHORD (id, data) VALUES (?, ?)', [po.id, JSON.stringify(po)]);
					}
					for (var i = 0; i < operations.del.length; i++) {
						var id = operations.del[i];
						tx.executeSql('DELETE FROM PURCHORD WHERE id = ?', [id]);
					}
				},
				function(err) {
					console.log("db transaction failed: " + err);
				},
				function() {
				}
			);
		}
	}
	
	this.db = function() {
		if (!('dbhandle' in model)) {
			var db = model.dbhandle = window.openDatabase("localstore", "1.0", "Local Store", 1048576);
			db.transaction(function(tx) {
				tx.executeSql('CREATE TABLE IF NOT EXISTS PURCHORD (id unique, data)');
				tx.executeSql('CREATE TABLE IF NOT EXISTS TOKEN (token unique, expires)');
			},
			function(err) {
				console.log("db open failed: " + err);
			},
			function() {
				console.log("db opened");
			})
		}
		return model.dbhandle;
	}
	
	this.receiveSync = function(syncData) {
		console.log("Sync data received");
		var results = model.poManager.sync(syncData);
		model.poManager.updateDb(results);
	}
	
	this.createLocation = function(po) {
		var dist = model.myDistanceTo(po.latitude, po.longitude);
		var location = {
			hash: po.lochash,
			name: po.locName,
			address: po.locAddress,
			latitude: po.latitude,
			longitude: po.longitude,
			radius: po.radius,
			pos: ko.observableArray(),
			dist: dist,
			distance: ko.observable(model.formatDistance(dist)),
		};
		location.status = ko.computed(function() {
			if (!this.pos)
				return 'undefined';
			var pos = this.pos();
			if (pos.length == 1)
				return pos[0].status();
			else if (pos.length == 0)
				return 'closed';
			// if any PO is checked in, then the status is checked in
			// if all are closed, then status is closed
			var closed = true;
			for (var i = 0; i < pos.length; i++) {
				var po = pos[i];
				if (po.status() == 'checkedin')
					return 'checkedin';
			}
			for (var i = 0; i < pos.length; i++) {
				var po = pos[i];
				if (po.status() == 'reqauth')
					return 'reqauth';
			}
			for (var i = 0; i < pos.length; i++) {
				var po = pos[i];
				if (po.status() == 'reqfollowup')
					return 'reqfollowup';
			}
			for (var i = 0; i < pos.length; i++) {
				var po = pos[i];
				if (po.status() != 'closed')
					closed = false;
			}
			if (closed)
				return 'closed';
		}, location);
		return location;
	}
	
	this.refreshLocations = function() {
		model.doSync();
	}
	
	this.selectLocation = function(location) {
		model.currentLocation(location);
		var pos = model.currentLocation().pos();
		var poCount = pos.length; 
		if (poCount == 1) {
			model.selectPo(pos[0]);
		}
		else {
			var screen = Screens.push('polist');
			screen.cancel = function() {
				model.currentLocation(null);
			}
		}
	}
	
	this.checkin = function() {
		model.currentPo().status('checkedin');
		model.currentPo(null);
		var screen = Screens.pop();
	}
	
	this.completeJob = function() {
		model.currentPo().status('closed');
		model.currentPo(null);
		var screen = Screens.pop();
	}
	
	this.incompleteJob = function() {
		model.currentPo().status('incomplete');
		model.currentPo(null);
		var screen = Screens.pop();
	}
	
	this.cancel = function() {
		var screen = Screens.pop();
		screen.cancel();
	}
	
	this.selectPo = function(po) {
		model.currentPo(po);
		var screen = Screens.push('details');
		screen.cancel = function() {
			model.currentPo(null);
		}
	}
	
	this.map = function(map, jso, modelo) {
		var rules = map['rules'];
		var stat = map['static'];
		for (prop in jso) {
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
		for (s in stat) {
			if (!(s in modelo))
				modelo[s] = stat[s];
		}
	}

	this.maps = {
		po: {
			'static': {
			},
			'rules': {
				'status': function (val) { if (!this.status) { this.status = ko.observable(val); } else { this.status(val); }},
			},
		},
	};
};

Screens.define({
	locations: {
		activate: function(model) {
			model.doSync();
		},
		initialize: function(e, model) {
			// Setup Search Box
			$searchbox = $("#searchbox");
			$searchbox.focus(function() {
				if (!this.unempty)
					this.value = "";
				$searchbox.removeClass("prompt");
			});
			$searchbox.change(function() {
				this.unempty = this.value != "";
			});
			$searchbox.blur(function() {
				if (!this.unempty) {
					this.value = "enter PO number";
					$searchbox.addClass("prompt");
				}
			});
			
			
			// Setup sorters
			// Select sort-by-distance as default
			model.selectSort("sort_by_dist");
			// Setup event handler for changing sort
			$(".sortbox").touchstart(function() {
				model.selectSort(this.id);
			});
			
			navigator.geolocation.watchPosition(function(position) {
				model.onPositionUpdate(position);
			}, function() {
				// TODO: add indicator for bad GPS
			}, { frequency: 3000, maximumAge: 60000, timeout: 60000, enableHighAccuracy: true });
		}
	},
	checkedin : {
		initialize: function() {
		},
	},
	details: {
		initialize: function(e, model) {
			$sliderdiv = $('#checkinout');
			if (model.currentPo().status() == 'closed') {
				$sliderdiv.hide();
			}
			else {
				var slider = new Slider($sliderdiv);
				slider.direction(model.currentPo().status() == 'checkedin' ? 1 : -1);
				var statuses = ['closed', 'reqauth', 'reqfollowup'];
				slider.setEndOptions(1, ['Job Complete', 'Requires Authorization', 'Follow-up Required']);
				slider.onSlid = function(direction, option) {
					var isCheckin = direction == -1;
					if (isCheckin) {
						slider.disableWith("Checking in...");
						var success = function() {
							slider.enable();
						}
						var fail = function() {
							slider.disableWith("Checkin failed");
							alert('There was a problem encountered while trying to checkin.  Please check your signal and data connection and try again');
							slider.direction(direction);
							slider.enable();
						}
						model.checkinCurrentPo(success, fail)
					}
					else {
						var status = statuses[option.index];
						slider.disableWith("Checking out...");
						var success = function(syncData) {
							slider.enable();
							if (model.currentPo().status == 'closed')
								$sliderdiv.hide();
						}
						var fail = function(jqXHR, textStatus, e) {
							slider.disableWith("Checkout failed");
							alert('There was a problem encountered while trying to checkout.  Please check your signal and data connection and try again');
							slider.enable();
							slider.direction(direction);
						}
						model.checkoutCurrentPo(success, fail);
					}
				}
			}
		},
		back: function() {
			return Screens.pop();
		}
	},
	polist: {
		initialize: function(element, data) {
		},
		back: function() {
			return Screens.pop();
		},
	},
	login: {
		initialize: function(element, model) {
			var $page = $('#loginpage');
			var $area = $('#loginarea');
			$area.css({ 'top': ($page.width() * 0.3) + 'px' });

			// preload image
			var $logo = $('<div id="loginlogo"/>'); 
			$img = $('<img/>');
			$img[0].src = 'img/login-logo.png';
			$logo.append($img);
			$logo.css('visibility', 'hidden');
			$logo.hide();
			$area.append($logo);
			
			// add the login form
			var $form = $('<div id="loginform"/>');
			$form.append($('#html_loginform').html());
			$area.append($form);
		}
	}
});

Handlebars.registerHelper('hasMultiple', function(item, options) {
	return (item.length && item.length > 1) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('getStatus', function(item, options) {
	if (item.length == 1)
		return item[0].status;
});

//  format an ISO date using Moment.js
//  http://momentjs.com/
//  moment syntax example: moment(Date("2011-07-18T15:50:52")).format("MMMM YYYY")
//  usage: {{dateFormat creation_date format="MMMM YYYY"}}
Handlebars.registerHelper('dateFormat', function(context, block) {
  if (window.moment) {
    var f = block.hash.format || "MMM Do, YYYY";
    return moment(Date(context)).format(block.hash.format || "MMM Do, YYYY");
  }else{
    return context;   //  moment plugin not available. return data as is.
  };
});

// For some reason, this is needed to make buttons appear "activated" when tapped
$(document).on('touchstart', function(e) {
});

var init = function() {
	console.log("ready");
	Screens.init();
	var model = new ViewModel();
	model.doAppAuth();
}

if (ON_DEVICE)
	document.addEventListener('deviceready', init, false);
else
	$(document).ready(init);

