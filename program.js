(function(){

	const memory = (function(){
		// Returns null if it can't do it, false if there's an error, true if it saved OK
		function mozillaSaveFile(filePath,content)
		{
			if(window.Components) {
				try {
					netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
					var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
					file.initWithPath(filePath);
					if(!file.exists())
						file.create(0,0664);
					var out = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
					out.init(file,0x20|0x02,00004,null);
					out.write(content,content.length);
					out.flush();
					out.close();
					return true;
				} catch(ex) {
					return false;
				}
			}
			return null;
		}
		function convertUriToUTF8(uri,charSet)
		{
			if(window.netscape == undefined || charSet == undefined || charSet == "")
				return uri;
			try {
				netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
				var converter = Components.classes["@mozilla.org/intl/utf8converterservice;1"].getService(Components.interfaces.nsIUTF8ConverterService);
			} catch(ex) {
				return uri;
			}
			return converter.convertURISpecToUTF8(uri,charSet);
		}
		function getLocalPath(origPath)
		{
			var originalPath = convertUriToUTF8(origPath, "UTF-8");
			// Remove any location or query part of the URL
			var argPos = originalPath.indexOf("?");
			if(argPos != -1)
				originalPath = originalPath.substr(0,argPos);
			var hashPos = originalPath.indexOf("#");
			if(hashPos != -1)
				originalPath = originalPath.substr(0,hashPos);
			// Convert file://localhost/ to file:///
			if(originalPath.indexOf("file://localhost/") == 0)
				originalPath = "file://" + originalPath.substr(16);
			// Convert to a native file format
			var localPath;
			if(originalPath.charAt(9) == ":") // pc local file
				localPath = unescape(originalPath.substr(8)).replace(new RegExp("/","g"),"\\");
			else if(originalPath.indexOf("file://///") == 0) // FireFox pc network file
				localPath = "\\\\" + unescape(originalPath.substr(10)).replace(new RegExp("/","g"),"\\");
			else if(originalPath.indexOf("file:///") == 0) // mac/unix local file
				localPath = unescape(originalPath.substr(7));
			else if(originalPath.indexOf("file:/") == 0) // mac/unix local file
				localPath = unescape(originalPath.substr(5));
			else // pc network file
				localPath = "\\\\" + unescape(originalPath.substr(7)).replace(new RegExp("/","g"),"\\");
			return localPath;
		}
		
		const entries = document.getElementById('entries');
		const cached = eval(entries.innerHTML);
		const html = document.getElementsByTagName('html')[0];
		var saved = eval(entries.innerHTML);

		return {
			save: function(){
				try {
					entries.innerHTML = '({\n\t\t\t'+ cached.toSource().slice(2,-2).replace(/(\w+:"(?:[^\\"]|\\.)*"),\s*/g, '$1\n').split("\n").sort().join(',\n\t\t\t') + '\n\t\t})';

					const originalPath = document.location.toString();
					if(originalPath.substr(0,5) != "file:") 
					{
						alert("I'm sorry, this can only be saved locally.  Save this file to disk, then make your changes and try again");
						return false;
					}
					const localPath = getLocalPath(originalPath);
					if (mozillaSaveFile(localPath, '<html>' + html.innerHTML + '</html>'))
					{
						saved = eval(entries.innerHTML);
						return true;
					}
					else
					{
						return false;
					}
				} catch (e) {
					alert(e);
					return false;
				}
			},
			get: function(id) {
				return (typeof cached[id] != "undefined") ? cached[id] : "";
			},
			set: function(id, formula) {
				if (formula == "")
					delete cached[id];
				else
					cached[id] = formula;
				return (cached[id] != saved[id]);
			}
		};
	})();

	// compile a formula into
	// * a string that can be eval'ed to get the display value
	// * a list of graph that it depends on.
	const RecursiveReferenceException = function() {
		this.loop = [];
	};
	const compileAndEval  = function(formulas){
		const consumeRegex = function( regex ) {
			return function( state ) {
				m = state.unparsed.match( regex )
				if (m) {
					state.unparsed = state.unparsed.slice(m[0].length);
					state.parsed += m[0];
					return m;
				}
				return false;
			};
		};
		const parseString = consumeRegex(/^(?:"(?:[^\\"]|\\.)*"|'(?:[^\\']|\\.)*')/);
		const parseComment = consumeRegex(/^(?:\/\/.*\n|\/\*(?:\n|.)*?\*\/)/);
		const parseNonParen = consumeRegex(/^[^()]/);
		const parseTerm = function( state ) {
			m = consumeRegex(/^(\w+)(?:\.\w+)*/)(state);
			if (m) {
				if (typeof formulas[m[1]] != 'undefined' && state.variables.indexOf(m[1]) == -1) 
					state.variables.push(m[1]);
				return true;
			}
			return false;
		};
		const parseParens = function( state ) {
			if (! consumeRegex(/^\(/)(state) ) return false;
			while( parseString( state )		||
						 parseComment( state )  ||
						 parseTerm( state )	||
						 parseNonParen( state ) ||
						 parseParens( state )		);
			return consumeRegex(/^\)/)(state);
		};

		// compile a formula into evaluatable javascript
		const compile = function(formula) {
			const sections = [];
			const vars = [];
			var start= 0;
			var next;
			while ( (next = formula.indexOf('=(', start)) >= 0 ) {
				sections.push(formula.slice( start, next ).toSource());

				const state = {
					unparsed: formula.slice(next+1),
					parsed: "",
					variables: vars
				};
				if ( !parseParens( state ) ) break;

				sections.push( state.parsed );
				start = next + 1 + state.parsed.length;
			};
			sections.push(formula.slice( start ).toSource());

			return {
				formula: formula,
				value: '?',
				script: sections.join('+'),
				variables: vars,
				occurences: []
			};
		};

		const evalScript = function( source, context ) {
			with(context) { return eval(source); }
		}

		// sort the boxes and render them
		const evalSublattice = function(ids, program) {
			const seen = {};
			const stack = [];
			var i;
			const dfs = function(id) {
				if (seen[id]) {
					if (seen[id] == i) {
						var e = new RecursiveReferenceException;
						e.loop = [id];
						throw e;
					} else {
						return;
					}
				}
				seen[id] = i;
				try {
					program.graph[id].occurences.forEach(dfs);
				} catch(e) {
					if (e instanceof RecursiveReferenceException) {
						e.loop.push(id);
					}
					throw e;
				}
				stack.push(id);
				return;
			}
			for (i = 0; i < ids.length; ++i) 
				dfs(ids[i]);
			stack.reverse().forEach(function(id) {
				const result = evalScript( program.graph[id].script, program.context );
				program.graph[id].value = result;
				program.context[id] = result.match(/^[+-]?\d+$/) ? parseInt(result) : (result == "" ? 0 : result);
				//console.log('evaluating ' + id );
			});
			return stack;
		};

		const link = function(cell, id){
			cell.variables.forEach(function(var_name){
				program.graph[var_name].occurences.push(id);
			});
		};
		const unlink = function(cell, id){
			cell.variables.forEach(function(var_name){
				const variable = program.graph[var_name];
				variable.occurences.splice( variable.occurences.indexOf( id ), 1 );
			});
		};
		const program = {
			ids: [],
			graph: {},
			context: {},
			loop: undefined,
			update: function( id, formula ){
				const prev = program.graph[id];
				if (prev.formula == formula) return [];

				// remove previous dependency links
				unlink(prev, id);

				// update formula and add dependency links
				const edit = compile( formula );
				edit.occurences = prev.occurences;
				program.graph[id] = edit;
				link(edit, id);

				// update cell values
				try {
					return evalSublattice([id], program);
				}
				catch(e) {
					// restore to pre-edit state
					unlink(edit, id);
					program.graph[id] = prev;
					link(prev, id);
					throw e;
				}
			}
		};
		for (var id in formulas) 
			program.graph[id] = compile(formulas[id]);
		for (var id in program.graph) {
			link( program.graph[id], id );
			program.ids.push(id);
		}
		evalSublattice( program.ids, program );
		return program;
	};
	const addUI = function(region_id){

		const addClass = function(elt, class) {
			const classes = elt.className.split(' ');
			if (classes.indexOf(class) < 0)
			{
				classes.push(class);
				elt.className = classes.join(' ');
				return true;
			}
			else
			{
				return false;
			}
		};
		const hasClass = function(elt, class) {
			const classes = elt.className.split(' ');
			return (classes.indexOf(class) >= 0);
		};
		const remClass = function(elt, class) {
			const classes = elt.className.split(' ');
			const i = classes.indexOf(class);
			if (i >= 0)
			{
				classes.splice(i,1);
				elt.className = classes.join(' ');
				return true;
			}
			else
			{
				return false;
			}
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
					formulas[id] = memory.get( id );
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
		
		const EditBox							= document.getElementById('EditBox');
		const EditBoxTarget				= document.getElementById('EditBoxTarget');
		const EditBoxText					= document.getElementById('EditBoxText');
		const EditBoxTextMeasure	= document.getElementById('EditBoxTextMeasure');
		const EditBoxSave					= document.getElementById('EditBoxSave');
		const EditBoxX						= document.getElementById('EditBoxX');

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
			EditBoxTextMeasure.innerHTML = EditBoxText.value.replace(/[<>&]|$/g, function(m){
				return { '<': '&lt;', '>':'&gt;', '&':'&amp;', '':'&nbsp;' }[m];
			}).replace(/ {2,}/g, function(s){
				return s.slice(1).replace(' ', '&nbsp;') + ' ';
			}).replace(/\n/g, "<br/>");
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
					(memory.set( id, program.graph[id].formula ) ? addClass : remClass)(box, 'edited');
				}
				remClass(box,'selected');
			}
			catch (e) {
				handle(e);
				EditBox.style.display = 'block';
				EditBoxText.focus();
			}
		}, false);

		// hide the EditBox when you click the X
		EditBox.addEventListener('click', function(click_event) { 
				click_event.stopPropagation(); 
		}, false);
		EditBoxSave.addEventListener('click', function(click_event) { 
				click_event.stopPropagation();
				click_event.preventDefault();


				const edited = [];
				for (var id in boxes) (function(id, box){
					if (remClass(box, 'edited')) edited.push(box);
				})(id, boxes[id]);

				EditBox.style.display = '';
				if (!memory.save()) {
					edited.forEach(function(box){ addClass(box, 'edited') });
				}
				EditBox.style.display = 'block';
				return false;
		}, false);
		EditBoxX.addEventListener('click', function(click_event) { 
				click_event.stopPropagation();
				click_event.preventDefault();
				EditBox.style.display = 'none'; 
				return false;
		}, false);
		region.addEventListener('click', function(click_event) { 
				EditBox.style.display = 'none'; 
		}, false);
		return program;
	};
	const program = addUI('CharacterSheet');
})();
