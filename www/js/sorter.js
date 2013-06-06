function Sorter(element) {
	var control = this;
	var $e = $(element);
	$e.addClass('sorters');
	$e.data('control', control);
	control.sorters = {}
	control.currentSorter = null;

	function createSortBox(text, id) {
		console.log("Creating sorter " + id);
		var $d = $('<div class="sortbox"/>');
		$d.text(text);
		$d.append('<div class="arrow"></div>');
		$d.on('mousedown', function() {
			element.setAttribute('data-selected', id);
		});
		return $d;
	}

	function setSorters(sorters) {
		if (sorters) {
			if (typeof sorters == 'string') {
				sorters = JSON.parse(sorters);
			}
			control.sorters = sorters;
			$.each(sorters, function(i, sorter) {
				var $d = createSortBox(sorter.text, sorter.id);
				$e.append($d);
				sorter.element = $d.get(0);
				control.sorters[sorter.id] = sorter;
			});
		}
	}

	function setSelected(sorter) {
		if (!sorter)
			return;
		if (typeof sorter !== 'string')
			sorter = sorter.id;
		// find the sorter by the given id
		sorter = control.sorters[sorter];
		if (control.currentSorter != null)
			$(control.currentSorter.element).removeClass('current');
		if (sorter != null)
			$(sorter.element).addClass('current');
		control.currentSorter = sorter;
	}

	// hook attribute setting
	var baseSetAttribute = element.setAttribute;
	var attributeHooks = {
		'data-sorters': setSorters,
		'data-selected': setSelected,
	};
	element.setAttribute = function(n,v) {
		baseSetAttribute.call(element, n, v);
		var func = attributeHooks[n];
		if (func)
			func.call(control, v);
	};

	for (var hook in attributeHooks) {
		var func = attributeHooks[hook];
		func.call(control, element.getAttribute(hook));
	}
}
