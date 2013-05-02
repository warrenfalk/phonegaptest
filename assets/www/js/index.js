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
			
			
			// Setup location click handler
			var locationSelect = function(location) {
				location.pos[0].loc = location;
				Screens.push('details', location.pos[0]);
			}
			
			
			// Receive location data
			var receiveLocations = function(data) {
			    $('#records .loading').fadeOut();
					
				var locationTemplate = Handlebars.compile($('#location-template').html());
				var $locations = $("#records");
			    
			    $.each(data, function(i, location) {
					// construct row from template
					var $location = $('<div class="record"/>').append(locationTemplate(location));
					$locations.append($location);
					
					$location.touchstart(ui.highlight);
					$location.click(function() { locationSelect(location); });
			    });
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
			$("#detail_cancel").click(function() {
				Screens.pop();
			});
		}
	},
});

Screens.push('locations');

Handlebars.registerHelper('hasMultiple', function(item, options) {
	return (item.length && item.length > 1) ? options.fn(this) : options.inverse(this);
})

// For some reason, this is needed to make buttons appear "activated" when tapped
$(document).on('touchstart', function(e) {
});
