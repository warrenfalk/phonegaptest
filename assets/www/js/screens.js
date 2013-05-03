this.Screens = {
	_stack: [],
	_top: null,
	_screens: {},
	
	push: function(screen, data) {
		data = data || [];
		if (typeof screen === 'string')
			screen = this._screens[screen];
		var template = Handlebars.compile($('#' + screen.template).html());
		if (this._top)
			this._top.$element.hide();
		screen.$element = $("<div/>");
		this._stack.push(this._top = screen);
		screen.$element.append(template(data));
		$("#page").append(screen.$element);
		if (screen.initialize)
			screen.initialize(screen.$element, data);
	},
	
	pop: function() {
		if (this._stack.length <= 1)
			return;
		this._top = this._stack.pop();
		this._top.$element.remove();
		this._top = this._stack[this._stack.length - 1];
		this._top.$element.show();
	},
	
	define: function(screens) {
		for (name in screens) {
			var screen = screens[name];
			screen.name = name;
			screen.template = screen.template || 'screen_' + screen.name;
			this._screens[name] = screen;
		}
	},
	
	showError: function(error) {
		$errdiv = $('<div id="error"/>');
		$errdiv.text("Error: " + error.stack);
		$("#page").append($errdiv);
	},
	
	makeList: function(recordTemplate, recordClass, parentElement, data, clickHandler) {
		if (typeof recordTemplate == 'string')
			recordTemplate = Handlebars.compile($('#' + recordTemplate).html());
		
		var $parentElement = $('#' + parentElement);
	    
	    $.each(data, function(i, record) {
			// construct row from template
			var $record = $('<div class="' + recordClass + ' record"/>').append(recordTemplate(record));
			$parentElement.append($record);
			
			$record.click(function() { clickHandler(record); });
	    });
		
	},
	
	init: function() {
		document.addEventListener('deviceready', function() {
			document.addEventListener('backbutton', function() {
				var top = Screens._top;
				if (!top) {
					navigator.ap.exitApp();
					return true;
				}
				if (!top.back) {
					if (Screens._stack.length > 1)
						Screens.pop();
					return false;
				}
				top.back();
				return false;
			}, true);
		}, false);
	}
};

