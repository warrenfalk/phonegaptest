viewModel = {
	location: ko.observableArray(),

	receiveLocations: function(locations) {
		this.map.locations(locations, this.location);
	},
	
	map: {
		locations: function(objin, objout) {
			for (var i = 0; i < objin.length; i++) {
				var location = this.location(objin[i]);
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
					select: function() {
				    	var details = {
				    		loc: this,
				    		po: this.pos()[0],
				    	};
					    Screens.push('details', details);
					},
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
					return 'unknown'; // TODO: calculate correctly
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
					status: ko.observable(objin.status),
		    		checkin: function() {
		    			this.status('checkin');
		    			Screens.pop();
		    		}
				}
			}
			else {
				objout.status(objin.status);
			}
			return objout;
		}
	},
};

Screens.define({
	locations: {
		initialize: function() {
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
		    	viewModel.receiveLocations(locations);
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
	details: {
		initialize: function() {
		},
		back: function() {
			return Screens.pop();
		}
	},
	polist: {
		initialize: function(element, data) {
			var screen = this;
			
			$("#polist_cancel").click(function() {
				screen.back();
			});
			
		    var list = Screens.makeList('po_record', 'porecord', 'polist', data.pos, function (po) {
		    	var details = {
		    		loc: data,
		    		po: po,
		    		checkin: function() {
		    			this.po.status = 'checkin';
		    		}
		    	};
		    	Screens.push('details', details)
		    })
		},
		back: function() {
			return Screens.pop();
		},
		refresh: function() {
			alert('refreshing');
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
    return moment(Date(context)).format(f);
  }else{
    return context;   //  moment plugin not available. return data as is.
  };
});

// For some reason, this is needed to make buttons appear "activated" when tapped
$(document).on('touchstart', function(e) {
});


$(document).ready(function() {
	Screens.init();
	Screens.push('locations', viewModel);
});

