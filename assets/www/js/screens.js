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
			this._top.hide();
		screen.$element = $("<div/>");
		this._stack.push(this._top = screen);
		screen.$element.append(template(data));
		$("#page").append(screen.$element);
		if (screen.initialize)
			screen.initialize(screen.$element);
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
			screen = screens[name];
			screen.name = name;
			screen.template = screen.template || 'screen_' + screen.name;
			this._screens[name] = screen;
		}
	}
};
