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
			program.context[id] = result.match(/^[+-]?\d+$/) ? parseInt(result) : result;
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
