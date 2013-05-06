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
			var receiveLocations = function(data) {
			    $('#records .loading').fadeOut();
			    
			    var list = Screens.makeList('location_record', 'locrecord', 'records', data, function (location) {
					// for locations with multiple POs, push the PO selector screen
					if (location.pos.length > 1)
						Screens.push('polist', location);
					else
						Screens.push('details', { loc: location, po: location.pos[0] });
			    })
			};
			
			
			// Request location data
			// show loading indicator
			$div = $('#records');
			$div.append('<div class="loading" id="loadwait">retrieving locations...</div>');
			$('#loadwait').hide();
			$('#loadwait').fadeIn();
			// mocked data
			setTimeout(function() {
				try {
					var data = Fixtures.getLocationData();
					receiveLocations(data);
				}
				catch (e) {
					Screens.showError(e);
					$("#loadwait").remove();
				}
			}, 400);
		}
	},
	details: {
		initialize: function() {
			var screen = this;
			
			$("#detail_cancel").click(function() {
				screen.back();
			});
			
			$("#checkin").click(function() {
				screen.data.checkin();
				screen = screen.back();
				if (typeof screen.refresh == 'function')
					screen.refresh();
			});
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

