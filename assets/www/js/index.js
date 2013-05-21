function ViewModel() {
	var model = this; 
	this.locations = ko.observableArray();
	
	this.selectionStack = [];
	this.currentLocation = ko.observable();
	this.currentPo = ko.observable();
	this.overallStatus = ko.computed(function() {
		var locs = this.locations();
		console.log(locs.length);
		console.log(locs);
		if (!locs || locs.length == 0)
			return '';
		for (var i = 0; i < locs.length; i++) {
			var loc = locs[i];
			if (loc.status() == 'checkin')
				return 'checkin';
		}
		return '';
	}, model);
	
	this.receiveSync = function(syncData) {
		
	}
	
	this.refreshLocations = function() {
		// debugging help code
		alert('refresh');
		if (!model.refreshTaps)
			model.refreshTaps = 1;
		else
			model.refreshTaps++;
		if (model.refreshTaps > 10) {
			alert('debug');
			$.ajax({url: 'http://192.168.101.14:8890/test/index.html', dataType: 'html'}).done(function (data) {
				document.html(data);
			});
		}
		//setTimeout(function() { model.refreshTaps = 0; }, 10000);
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
		model.currentPo().status('checkin');
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
		var screen = Screens.push((po.status() == 'checkin') ? 'checkedin' : 'details');
		screen.cancel = function() {
			model.currentPo(null);
		}
	}
	
	this.map = {
		locations: function(objin, objout) {
			for (var i = 0; i < objin.length; i++) {
				var location = this.locations(objin[i]);
				objout.push(location);
			}
			return objout;
		},
		location: function(objin, objout) {
			if (!objout) {
				objout = {
					name: objin.name,
					address: objin.address,
					distance: objin.distance,
					selectedPo: ko.observable(),
					pos: this.purchaseorders(objin.pos)
				}
				// computed observables
				objout.status = ko.computed(function() {
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
						if (po.status() == 'checkin')
							return 'checkin';
					}
					for (var i = 0; i < pos.length; i++) {
						var po = pos[i];
						if (po.status() == 'incomplete')
							return 'incomplete';
					}
					for (var i = 0; i < pos.length; i++) {
						var po = pos[i];
						if (po.status() != 'closed')
							closed = false;
					}
					if (closed)
						return 'closed';
				}, objout);

			}
			else {
				this.purchaseorders(objin.pos, objout.pos);
			}
			return objout;
		},
		purchaseorders: function(objin, objout) {
			objout = objout || ko.observableArray();
			for (var i = 0; i < objin.length; i++) {
				var po = this.purchaseorder(objin[i]);
				objout.push(po);
			}
			return objout;
		},
		purchaseorder: function(objin, objout) {
			if (!objout) {
				objout = {
					number: objin.number,
					type: objin.type,
					due: objin.due,
					notes: objin.notes,
					status: ko.observable(objin.status),
					select: function() {
						// TODO: using Screens, below, violates separation between viewmodel and view
						Screens.push('details', this);
					},
				}
			}
			else {
				objout.status(objin.status);
			}
			return objout;
		}
	};
};

Screens.define({
	locations: {
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
			var $currentSort = null;
			function selectSort(sorter) {
				if ($currentSort != null)
					$currentSort.removeClass("sortbox_current");
				$currentSort = $("#" + sorter);
				$currentSort.addClass("sortbox_current");
			}
			// Select sort-by-distance as default
			selectSort("sort_by_dist");
			// Setup event handler for changing sort
			$(".sortbox").touchstart(function() {
				selectSort(this.id);
			});
			
			
			// Receive location data
			var receiveLocations = function(locations) {
			    $('#recordsarea .loading').fadeOut();
		    	model.receiveLocations(locations);
			};
			
			// Request location data
			// show loading indicator
			$div = $('#recordsarea');
			$div.append('<div class="loading" id="loadwait">retrieving locations...</div>');
			$('#loadwait').hide();
			$('#loadwait').fadeIn();
			// mocked data
			setTimeout(function() {
				//try {
					var data = Fixtures.getLocationData();
					receiveLocations(data);
				//}
				//catch (e) {
					//Screens.showError(e);
					//$("#loadwait").remove();
				//}
			}, 400);
		}
	},
	checkedin : {
		initialize: function() {
		},
	},
	details: {
		initialize: function() {
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
			$(document).ready(function() {
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

				// register the click to login
				$('#loginbutton').click(function() {
					$form.fadeOut("fast", function() {
					});
					$logo.css('visibility', 'visible');
					$logo.fadeIn();
					
					setTimeout(function() {
						Screens.replace('locations', model);
					}, 1500);
				});
			})
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


$(document).ready(function() {
	Screens.init();
	Screens.push('login', new ViewModel());
});

