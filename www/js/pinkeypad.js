function PinKeyPad(div) {
	var $div = $(div);
	$div.addClass('pinkeypad');
	var control = this;
	$div.data('control', control);
	this.currentPin = '';

	var pinLength = parseInt($div.attr('data-pin-length') || '5');

	this.keys = [];
	this.feedbackCells = [];

	var $feedback = $('<div class="feedback"/>');
	$div.append($feedback);

	var createCustomEvent;
	if (typeof CustomEvent === 'undefined') {
		createCustomEvent = function(type, dict) {
			var e = document.createEvent('Event');
			e.initEvent(type, dict['bubbles'], dict['cancelable']);
			if (dict.detail) {
				if (!e.detail)
					e.detail = {};
				for (q in dict.detail)
					e.detail[q] = dict.detail[q];
			}
			return e;
		};
	}
	else {
		createCustomEvent = function(type, dict) {
			return new CustomEvent(type, dict);
		}
	}


	for (var pd = 0; pd < pinLength; pd++) {
		(function(pd) {
			var $cell = $('<div class="cell"/>');
			control.feedbackCells[pd] = { cell: $cell };
			$feedback.append($cell);
		})(pd);
	}

	var $keypad = $('<div class="keypad"/>');
	$div.append($keypad);

	this.keyClick = function(key) {
		var keynum = key.index;
		if (key.index < 10) {
			// number key was pressed
			control.currentPin = control.currentPin + ('' + keynum);
			$.each(control.feedbackCells, function(i,v) {
				v.cell.toggleClass('filled', control.currentPin.length > i);
			});
			if (control.currentPin.length == pinLength) {
				var event = createCustomEvent('enter', { detail: { control: control, pin: this.currentPin }});
				div.dispatchEvent(event);
			}
		}
		else if (key.index == 11) {
			control.currentPin = '';
			$.each(control.feedbackCells, function(i,v) {
				v.cell.removeClass('filled');
			});
		}
		else if (key.index == 10) {
			control.currentPin = '';
			$.each(control.feedbackCells, function(i,v) {
				v.cell.removeClass('filled');
			});
			var event = createCustomEvent('cancel', { detail: { control: control }});
			div.dispatchEvent(event);
		}
	};

	$.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "L", "R"], function(i,k) {
		var $key = $('<button class="key"/>');
		$key.addClass('key' + k);
		var $keytext = $('<span class="text"/>');
		$key.append($keytext);
		var key = { button: $key, index: i };
		$key.mousedown(function() { control.keyClick(key); })
		switch (k) {
			case "R":
				$keytext.text("Clear");
				break;
			case "L":
				$keytext.text("Change Login");
				break;
			default:
				$keytext.text(k);
				control.keys[k] = key;
				break;
		}
		$keypad.append($key);
	});

	this.bind = function(propname, target) {
		if (typeof target == 'function')
			div.addEventListener(propname, target, false);
	};

	this.pin = function(newpin) {
		if (arguments.length = 1) { 
			this.currentPin = newpin;
		}
	};
}