function Sorter(element) {
	var control = this;
	var $e = $(element);
	$e.addClass('sorters');
	$e.data('control', control);
	control.sortermap = {}
	control.currentSorter = null;

	if ('sorters' in element.dataset)
		sorters(element.dataset.sorters);
	if ('selected' in element.dataset)
		selected(element.dataset.selected);

	function createSortBox(text, id) {
		console.log("Creating sorter " + id);
		var $d = $('<div class="sortbox"/>');
		$d.text(text);
		$d.append('<div class="arrow"></div>');
		$d.on('mousedown', function() {
			control.selected(id);
		});
		return $d;
	}

	control.sorters = function(sorters) {
		if (arguments.length === 0)
			return control._sorters;
		control._sorters = sorters;
		if (typeof sorters == 'string') {
			sorters = JSON.parse(sorters);
		}
		control.sortermap = {};
		$.each(sorters, function(i, sorter) {
			var $d = createSortBox(sorter.text, sorter.id);
			$e.append($d);
			sorter.element = $d.get(0);
			control.sortermap[sorter.id] = sorter;
		});
	};

	control.selected = function(sorter) {
		if (arguments.length === 0)
			return control._selected;
		control._selected = sorter;
		if (!sorter)
			return;
		if (typeof sorter !== 'string')
			sorter = sorter.id;
		// find the sorter by the given id
		sorter = control.sortermap[sorter];
		if (control.currentSorter != null)
			$(control.currentSorter.element).removeClass('current');
		if (sorter != null)
			$(sorter.element).addClass('current');
		control.currentSorter = sorter;
		if (control['onselectedchange'])
			control['onselectedchange'](sorter.id);
	};

	control.onchange = function(propname, callback) {
		var event = 'on' + propname + 'change';
		var prev = control[event];
		control[event] = function(newval) {
			callback(newval);
			if (prev)
				prev(newval);
		};
	};

}
