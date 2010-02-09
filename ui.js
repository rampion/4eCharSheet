const addUI = function(region_id, defaults){

	if (!defaults) defaults = {};

	const addClass = function(elt, class) {
		const classes = elt.className.split(' ');
		if (classes.indexOf(class) < 0)
			classes.push(class);
		elt.className = classes.join(' ');
	};
	const hasClass = function(elt, class) {
		const classes = elt.className.split(' ');
		return (classes.indexOf(class) >= 0);
	};
	const remClass = function(elt, class) {
		const classes = elt.className.split(' ');
		const i = classes.indexOf(class);
		if (i >= 0)
			classes.splice(i,1);
		elt.className = classes.join(' ');
	};

	const formulas = {};
	const region = document.getElementById(region_id);
	const boxes = (function(){
		const spans = region.getElementsByTagName('span');
		const boxes = {};
		for (var i=0; i < spans.length; ++i) {
			var span = spans[i];
			if (hasClass(span, 'box') && span.id.match(/^_/)) { 
				var id = span.id.slice(1);
				boxes[id] = span;
				if (!defaults[id]) defaults[id] = "";
				formulas[id] = load( id, defaults[id] );
				if (formulas[id] != defaults[id]) 
					addClass(box, 'edited');
			}
		}
		return boxes;
	})();

	const handle = function(e) {
		if (e instanceof RecursiveReferenceException ) {
			alert( "Unable to render formulas (recursive loop):\n\t"+e.loop.join(" ->\n\t") );
		}
		else if (e.message) {
			alert( "Unable to render formulas: " + e.message );
		}
		else {
			alert( "Unable to render formulas: " + e);
		}
	};
	
	try {
		const program = compileAndEval( formulas );
	}
	catch (e) {
		handle(e);
		return;
	}
	
	const EditBox = document.createElement('div');
	EditBox.id = 'EditBox';
	const EditBoxTarget = document.createElement('div');
	EditBox.appendChild(EditBoxTarget);
	EditBoxTarget.id = 'EditBoxTarget';
	const EditBoxText = document.createElement('textarea');
	EditBox.appendChild(EditBoxText);
	EditBoxText.id = 'EditBoxText'
	const EditBoxTextMeasure = document.createElement('div');
	EditBox.appendChild(EditBoxTextMeasure);
	EditBoxTextMeasure.id = 'EditBoxTextMeasure'
	EditBoxTextMeasure.appendChild(document.createTextNode(''));
	const EditBoxX = document.createElement('a');
	EditBox.appendChild(EditBoxX);
	EditBoxX.id = 'EditBoxX';
	EditBoxX.href = "#";
	EditBoxX.innerHTML = 'X';

	if (region.firstChild)
		region.insertBefore( EditBox, region.firstChild );
	else
		region.appendChild( EditBox );

	// go through each of the entry boxes
	for (var id in boxes) (function(id, box){
		// set display text
		box.innerHTML = program.graph[id].value;

		// edit this box on click/tab
		const box_select = function(event) {
			EditBoxTarget.innerHTML = id;
			EditBox.style.display = 'block';
			addClass(box, 'selected');
			EditBoxText.value = program.graph[id].formula;
			resizeEditBoxText();
			EditBoxText.focus();
			event.stopPropagation();
		};
		box.addEventListener("focus", box_select, false);
		box.addEventListener("click", box_select, false);

		// highlight this box
		box.addEventListener("mouseover", function(over_event) { addClass(box, "moused"); }, false);
		box.addEventListener("mouseout", function(out_event) { remClass(box, "moused"); }, false);
	})(id, boxes[id]);
	

	// make the EditBox fit the text
	const resizeEditBoxText = function(event) {
		EditBoxTextMeasure.firstChild.nodeValue = EditBoxText.value.replace(/[<>&\n]|$/g, function(m){
			return { '<': '&lt;', '>':'&gt;', '&':'&amp;', "\n":'<br/>', '':'&nbsp;' }[m];
		}).replace(/ {2,}/g, function(s){
			return s.slice(1).replace(' ', '&nbsp;') + ' ';
		});
		EditBoxTextMeasure.style.display = 'block';
		var calcHeight = (EditBoxTextMeasure.offsetHeight+20);
		EditBoxTextMeasure.style.display = 'none';

		if (calcHeight > 0.5 * window.innerHeight)
			calcHeight = 0.5 * window.innerHeight;

		EditBoxText.style.height =  calcHeight + 'px';
	};
	EditBoxText.addEventListener('keyup', resizeEditBoxText, false);


	// save changes when done
	EditBoxText.addEventListener('blur', function(blur_event) {
		const id = EditBoxTarget.innerHTML;
		const box = boxes[id];
		if (!box) return;

		try {
			var touched = program.update(id, EditBoxText.value);
			if (touched.length > 0)
			{
				touched.forEach(function(t_id){
					boxes[t_id].innerHTML = program.graph[t_id].value;
				});
				(program.graph[id].formula != defaults[id] ? addClass : remClass)(box, 'edited');
				save( id, program.graph[id].formula );
			}
			remClass(box,'selected');
		}
		catch (e) {
			handle(e);
			EditBox.style.display = 'block';
			EditBoxText.focus();
		}
	}, false);

	// hide the EditBox when you click away
	EditBox.addEventListener('click', function(click_event) { click_event.stopPropagation(); }, false);
	EditBoxX.addEventListener('click', function(click_event) { EditBox.style.display = 'none'; return false;}, false);
	region.addEventListener('click', function(click_event) { EditBox.style.display = 'none'; }, false);
	return program;
};
