(function(){

	const cached = {};
	const load = function(id, formula) {
		if (typeof cached[id] != "undefined") return cached[id];
		return formula;
	};
	const save = function(id, formula) {
		cached[id] = formula;
		return true;
	};

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
						addClass(span, 'edited');
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
		const EditBoxX = document.createElement('a');
		EditBox.appendChild(EditBoxX);
		EditBoxX.id = 'EditBoxX';
		EditBoxX.href = window.location;
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

		// hide the EditBox when you click the X
		EditBox.addEventListener('click', function(click_event) { 
				click_event.stopPropagation(); 
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
	const program = addUI('CharacterSheet', {
		PlayerName: "",

		CharacterName: "",
		Level: "1",
		Class: "",
		ParagonPath: "",
		EpicDestiny: "",
		TotalExperience: "1",

		Race: "",
		Size: "",
		Age: "",
		Gender: "",
		Height: "",
		Weight: "",
		Alignment: "",
		Deity: "",
		Affiliation: "",

		Initiative: "=(InitiativeAbilMod + InitiativeHalfLevel + InitiativeMisc)",
		InitiativeConditionalModifiers: "",
		InitiativeAbilMod: "=(DexMod)",
		InitiativeHalfLevel: "=(roundDown(Level/2))",
		InitiativeMisc: "",

		Str: "=(pointBuy(10,9))",
		Dex: "=(pointBuy(10,5))",
		Con: "=(pointBuy(10,3))",
		Wis: "=(pointBuy(10,2))",
		Int: "=(pointBuy(10,1))",
		Cha: "=(pointBuy(8,2))",

		StrMod: "=(roundDown(Str/2) - 5)",
		DexMod: "=(roundDown(Dex/2) - 5)",
		ConMod: "=(roundDown(Con/2) - 5)",
		WisMod: "=(roundDown(Wis/2) - 5)",
		IntMod: "=(roundDown(Int/2) - 5)",
		ChaMod: "=(roundDown(Cha/2) - 5)",

		StrModPlusHalfLevel: "=(StrMod + roundDown(Level/2))",
		DexModPlusHalfLevel: "=(DexMod + roundDown(Level/2))",
		ConModPlusHalfLevel: "=(ConMod + roundDown(Level/2))",
		WisModPlusHalfLevel: "=(WisMod + roundDown(Level/2))",
		IntModPlusHalfLevel: "=(IntMod + roundDown(Level/2))",
		ChaModPlusHalfLevel: "=(ChaMod + roundDown(Level/2))",

		ArmorClass: "=(ArmorClass10PlusHalfLevel + ArmorClassArmorSlashAbil + ArmorClassClass + ArmorClassFeat + ArmorClassEnh + ArmorClassMisc1 + ArmorClassMisc2)",
		ArmorClass10PlusHalfLevel: "=(10 + roundDown(Level/2))",
		ArmorClassArmorSlashAbil: "=(max(DexMod,IntMod) /* add light armor bonus, or replace with heavy armor bonus */)",
		ArmorClassClass: "",
		ArmorClassFeat: "",
		ArmorClassEnh: "",
		ArmorClassMisc1: "",
		ArmorClassMisc2: "",
		ArmorClassConditionalBonuses: "",

		Fortitude: "=(Fortitude10PlusHalfLevel + FortitudeAbil + FortitudeClass + FortitudeFeat + FortitudeEnh + FortitudeMisc1 + FortitudeMisc2)",
		Fortitude10PlusHalfLevel: "=(10 + roundDown(Level/2))",
		FortitudeAbil: "=(max(StrMod,ConMod))",
		FortitudeClass: "",
		FortitudeFeat: "",
		FortitudeEnh: "",
		FortitudeMisc1: "",
		FortitudeMisc2: "",
		FortitudeConditionalBonuses: "",

		Reflex: "=(Reflex10PlusHalfLevel + ReflexAbil + ReflexClass + ReflexFeat + ReflexEnh + ReflexMisc1 + ReflexMisc2)",
		Reflex10PlusHalfLevel: "=(10 + roundDown(Level/2))",
		ReflexAbil: "=(max(IntMod,DexMod) /* add shield bonus */)",
		ReflexClass: "",
		ReflexFeat: "",
		ReflexEnh: "",
		ReflexMisc1: "",
		ReflexMisc2: "",
		ReflexConditionalBonuses: "",

		Willpower: "=(Willpower10PlusHalfLevel + WillpowerAbil + WillpowerClass + WillpowerFeat + WillpowerEnh + WillpowerMisc1 + WillpowerMisc2)",
		Willpower10PlusHalfLevel: "=(10 + roundDown(Level/2))",
		WillpowerAbil: "=(max(WisMod,ChaMod))",
		WillpowerClass: "",
		WillpowerFeat: "",
		WillpowerEnh: "",
		WillpowerMisc1: "",
		WillpowerMisc2: "",
		WillpowerConditionalBonuses: "",

		Speed: "=(SpeedBase+SpeedArmor+SpeedItem+SpeedMisc)",
		SpeedBase: "",
		SpeedArmor: "",
		SpeedItem: "",
		SpeedMisc: "",
		SpecialMovement: "",

		PassiveInsight: "=(10+PassiveInsightSkillBonus)",
		PassiveInsightSkillBonus: "=(Insight)",
		PassivePerception: "=(10+PassivePerceptionSkillBonus)",
		PassivePerceptionSkillBonus: "=(Perception)",
		SpecialSenses: "",

		MaxHitPoints: "=(0 /* level 1 */ + (Level - 1)*( 0 /* per level */))",
		BloodiedHitPoints: "=(roundDown(MaxHitPoints/2))",
		SurgeValue: "=(roundDown(MaxHitPoints/4))",
		SurgesPerDay: "0",
		CurrentHitPoints: "=(MaxHitPoints)",
		CurrentSurgeUses: "=(SurgesPerDay)",
		SecondWindUsed: "",
		TemporaryHitPoints: "",
		DeathSavingThrowFailures1: "",
		DeathSavingThrowFailures2: "",
		DeathSavingThrowFailures3: "",
		SavingThrowMods: "",
		Resistances: "",
		CurrentConditionsAndEffects: "",

		ActionPoints: "1",
		ActionPointAddtionalEffects: "",

		RaceAbilityScoreMods: "",
		RaceFeatures1: "",
		RaceFeatures2: "",
		RaceFeatures3: "",
		RaceFeatures4: "",
		RaceFeatures5: "",
		RaceFeatures6: "",
		RaceFeatures7: "",
		RaceFeatures8: "",

		Attack1Ability: "Improvised Melee",
		Attack1AttBonus: "=(Attack1HalfLevel + Attack1Abil + Attack1Class + Attack1Prof + Attack1Feat + Attack1Enh + Attack1Misc)",
		Attack1HalfLevel: "=(roundDown(Level/2))",
		Attack1Abil: "=(StrMod)",
		Attack1Class: "",
		Attack1Prof: "",
		Attack1Feat: "",
		Attack1Enh: "",
		Attack1Misc: "",

		Attack2Ability: "Improvised Ranged",
		Attack2AttBonus: "=(Attack2HalfLevel + Attack2Abil + Attack2Class + Attack2Prof + Attack2Feat + Attack2Enh + Attack2Misc)",
		Attack2HalfLevel: "=(roundDown(Level/2))",
		Attack2Abil: "=(DexMod)",
		Attack2Class: "",
		Attack2Prof: "",
		Attack2Feat: "",
		Attack2Enh: "",
		Attack2Misc: "",

		Damage1Ability: "=(Attack1Ability)",
		Damage1Damage: "1d4 + =(Damage1Abil + Damage1Feat + Damage1Enh + Damage1Misc1 + Damage1Misc2)",
		Damage1Abil: "=(StrMod)",
		Damage1Feat: "",
		Damage1Enh: "",
		Damage1Misc1: "",
		Damage1Misc2: "",

		Damage2Ability: "=(Attack2Ability)",
		Damage2Damage: "1d4 + =(Damage2Abil + Damage2Feat + Damage2Enh + Damage2Misc1 + Damage2Misc2)",
		Damage2Abil: "=(DexMod)",
		Damage2Feat: "",
		Damage2Enh: "",
		Damage2Misc1: "",
		Damage2Misc2: "",

		BasicAttack1Attack: "=(Attack1AttBonus)",
		BasicAttack2Attack: "=(Attack2AttBonus)",
		BasicAttack3Attack: "",
		BasicAttack4Attack: "",

		BasicAttack1Defense: "AC",
		BasicAttack2Defense: "AC",
		BasicAttack3Defense: "",
		BasicAttack4Defense: "",

		BasicAttack1WeaponOrPower: "=(Attack1Ability)",
		BasicAttack2WeaponOrPower: "=(Attack2Ability)",
		BasicAttack3WeaponOrPower: "",
		BasicAttack4WeaponOrPower: "",
		BasicAttack1Damage: "",
		BasicAttack2Damage: "",
		BasicAttack3Damage: "",
		BasicAttack4Damage: "",

		Acrobatics: "=(AcrobaticsAbilModPlusHalfLevel + AcrobaticsTrained + AcrobaticsArmorPenalty + AcrobaticsMisc)",
		Arcana: "=(ArcanaAbilModPlusHalfLevel + ArcanaTrained + ArcanaMisc)",
		Athletics: "=(AthleticsAbilModPlusHalfLevel + AthleticsTrained + AthleticsArmorPenalty + AthleticsMisc)",
		Bluff: "=(BluffAbilModPlusHalfLevel + BluffTrained + BluffMisc)",
		Diplomacy: "=(DiplomacyAbilModPlusHalfLevel + DiplomacyTrained + DiplomacyMisc)",
		Dungeoneering: "=(DungeoneeringAbilModPlusHalfLevel + DungeoneeringTrained + DungeoneeringMisc)",
		Endurance: "=(EnduranceAbilModPlusHalfLevel + EnduranceTrained + EnduranceArmorPenalty + EnduranceMisc)",
		Heal: "=(HealAbilModPlusHalfLevel + HealTrained + HealMisc)",
		History: "=(HistoryAbilModPlusHalfLevel + HistoryTrained + HistoryMisc)",
		Insight: "=(InsightAbilModPlusHalfLevel + InsightTrained + InsightMisc)",
		Intimidate: "=(IntimidateAbilModPlusHalfLevel + IntimidateTrained + IntimidateMisc)",
		Nature: "=(NatureAbilModPlusHalfLevel + NatureTrained + NatureMisc)",
		Perception: "=(PerceptionAbilModPlusHalfLevel + PerceptionTrained + PerceptionMisc)",
		Religion: "=(ReligionAbilModPlusHalfLevel + ReligionTrained + ReligionMisc)",
		Stealth: "=(StealthAbilModPlusHalfLevel + StealthTrained + StealthArmorPenalty + StealthMisc)",
		Streetwise: "=(StreetwiseAbilModPlusHalfLevel + StreetwiseTrained + StreetwiseMisc)",
		Thievery: "=(ThieveryAbilModPlusHalfLevel + ThieveryTrained + ThieveryArmorPenalty + ThieveryMisc)",

		AcrobaticsAbilModPlusHalfLevel: "=(roundDown(Level/2)+DexMod)",
		ArcanaAbilModPlusHalfLevel: "=(roundDown(Level/2)+IntMod)",
		AthleticsAbilModPlusHalfLevel: "=(roundDown(Level/2)+StrMod)",
		BluffAbilModPlusHalfLevel: "=(roundDown(Level/2)+ChaMod)",
		DiplomacyAbilModPlusHalfLevel: "=(roundDown(Level/2)+ChaMod)",
		DungeoneeringAbilModPlusHalfLevel: "=(roundDown(Level/2)+WisMod)",
		EnduranceAbilModPlusHalfLevel: "=(roundDown(Level/2)+ConMod)",
		HealAbilModPlusHalfLevel: "=(roundDown(Level/2)+WisMod)",
		HistoryAbilModPlusHalfLevel: "=(roundDown(Level/2)+IntMod)",
		InsightAbilModPlusHalfLevel: "=(roundDown(Level/2)+WisMod)",
		IntimidateAbilModPlusHalfLevel: "=(roundDown(Level/2)+ChaMod)",
		NatureAbilModPlusHalfLevel: "=(roundDown(Level/2)+WisMod)",
		PerceptionAbilModPlusHalfLevel: "=(roundDown(Level/2)+WisMod)",
		ReligionAbilModPlusHalfLevel: "=(roundDown(Level/2)+IntMod)",
		StealthAbilModPlusHalfLevel: "=(roundDown(Level/2)+DexMod)",
		StreetwiseAbilModPlusHalfLevel: "=(roundDown(Level/2)+ChaMod)",
		ThieveryAbilModPlusHalfLevel: "=(roundDown(Level/2)+DexMod)",

		AcrobaticsTrained: "",
		ArcanaTrained: "",
		AthleticsTrained: "",
		BluffTrained: "",
		DiplomacyTrained: "",
		DungeoneeringTrained: "",
		EnduranceTrained: "",
		HealTrained: "",
		HistoryTrained: "",
		InsightTrained: "",
		IntimidateTrained: "",
		NatureTrained: "",
		PerceptionTrained: "",
		ReligionTrained: "",
		StealthTrained: "",
		StreetwiseTrained: "",
		ThieveryTrained: "",

		AcrobaticsArmorPenalty: "",
		AthleticsArmorPenalty: "",
		EnduranceArmorPenalty: "",
		StealthArmorPenalty: "",
		ThieveryArmorPenalty: "",

		AcrobaticsMisc: "",
		ArcanaMisc: "",
		AthleticsMisc: "",
		BluffMisc: "",
		DiplomacyMisc: "",
		DungeoneeringMisc: "",
		EnduranceMisc: "",
		HealMisc: "",
		HistoryMisc: "",
		InsightMisc: "",
		IntimidateMisc: "",
		NatureMisc: "",
		PerceptionMisc: "",
		ReligionMisc: "",
		StealthMisc: "",
		StreetwiseMisc: "",
		ThieveryMisc: "",

		ClassPathDestinyFeatures1: "",
		ClassPathDestinyFeatures2: "",
		ClassPathDestinyFeatures3: "",
		ClassPathDestinyFeatures4: "",
		ClassPathDestinyFeatures5: "",
		ClassPathDestinyFeatures6: "",
		ClassPathDestinyFeatures7: "",
		ClassPathDestinyFeatures8: "",
		ClassPathDestinyFeatures9: "",
		ClassPathDestinyFeatures10: "",
		ClassPathDestinyFeatures11: "",
		ClassPathDestinyFeatures12: "",
		ClassPathDestinyFeatures13: "",
		ClassPathDestinyFeatures14: "",

		Feats1: "",
		Feats2: "",
		Feats3: "",
		Feats4: "",
		Feats5: "",
		Feats6: "",
		Feats7: "",
		Feats8: "",
		Feats9: "",
		Feats10: "",
		Feats11: "",
		Feats12: "",
		Feats13: "",
		Feats14: "",
		Feats15: "",
		Feats16: "",
		Feats17: "",

		LanguagesKnown1: "",
		LanguagesKnown2: "",
		LanguagesKnown3: "",

		AtWillPowers1: "",
		AtWillPowers2: "",
		AtWillPowers3: "",
		AtWillPowers4: "",
		AtWillPowers5: "",
		AtWillPowers6: "",

		EncounterPowers1: "",
		EncounterPowers2: "",
		EncounterPowers3: "",
		EncounterPowers4: "",
		EncounterPowers5: "",
		EncounterPowers6: "",
		DailyPowers1: "",
		DailyPowers2: "",
		DailyPowers3: "",
		DailyPowers4: "",
		DailyPowers5: "",
		DailyPowers6: "",
		UtilityPowers1: "",
		UtilityPowers2: "",
		UtilityPowers3: "",
		UtilityPowers4: "",
		UtilityPowers5: "",
		UtilityPowers6: "",
		UtilityPowers7: "",
		UtilityPowers8: "",

		EncounterPowersCheck1: "",
		EncounterPowersCheck2: "",
		EncounterPowersCheck3: "",
		EncounterPowersCheck4: "",
		EncounterPowersCheck5: "",
		EncounterPowersCheck6: "",
		DailyPowersCheck1: "",
		DailyPowersCheck2: "",
		DailyPowersCheck3: "",
		DailyPowersCheck4: "",
		DailyPowersCheck5: "",
		DailyPowersCheck6: "",
		UtilityPowersCheck1: "",
		UtilityPowersCheck2: "",
		UtilityPowersCheck3: "",
		UtilityPowersCheck4: "",
		UtilityPowersCheck5: "",
		UtilityPowersCheck6: "",
		UtilityPowersCheck7: "",
		UtilityPowersCheck8: "",

		MagicItemsWeapon1: "",
		MagicItemsWeapon2: "",
		MagicItemsWeapon3: "",
		MagicItemsWeapon4: "",
		MagicItemsArmor: "",
		MagicItemsArms: "",
		MagicItemsFeet: "",
		MagicItemsHands: "",
		MagicItemsHead: "",
		MagicItemsNeck: "",
		MagicItemsRing1: "",
		MagicItemsRing2: "",
		MagicItemsWaist: "",
		MagicItemsMisc1: "",
		MagicItemsMisc2: "",
		MagicItemsMisc3: "",
		MagicItemsMisc4: "",
		MagicItemsMisc5: "",
		MagicItemsMisc6: "",
		MagicItemsMisc7: "",
		MagicItemsMisc8: "",
		MagicItemsMisc9: "",
		MagicItemsMisc10: "",
		MagicItemsMisc11: "",
		MagicItemsMisc12: "",

		MagicItemsWeaponCheck1: "",
		MagicItemsWeaponCheck2: "",
		MagicItemsWeaponCheck3: "",
		MagicItemsWeaponCheck4: "",
		MagicItemsArmorCheck: "",
		MagicItemsArmsCheck: "",
		MagicItemsFeetCheck: "",
		MagicItemsHandsCheck: "",
		MagicItemsHeadCheck: "",
		MagicItemsNeckCheck: "",
		MagicItemsRingCheck1: "",
		MagicItemsRingCheck2: "",
		MagicItemsWaistCheck: "",
		MagicItemsMiscCheck1: "",
		MagicItemsMiscCheck2: "",
		MagicItemsMiscCheck3: "",
		MagicItemsMiscCheck4: "",
		MagicItemsMiscCheck5: "",
		MagicItemsMiscCheck6: "",
		MagicItemsMiscCheck7: "",
		MagicItemsMiscCheck8: "",
		MagicItemsMiscCheck9: "",
		MagicItemsMiscCheck10: "",
		MagicItemsMiscCheck11: "",
		MagicItemsMiscCheck12: "",

		DailyItemPowersHeroic: "",
		DailyItemPowersHeroicMilestone1: "",
		DailyItemPowersHeroicMilestone2: "",
		DailyItemPowersHeroicMilestone3: "",
		DailyItemPowersHeroicMilestone4: "",
		DailyItemPowersParagon1: "",
		DailyItemPowersParagon2: "",
		DailyItemPowersParagonMilestone1: "",
		DailyItemPowersParagonMilestone2: "",
		DailyItemPowersParagonMilestone3: "",
		DailyItemPowersParagonMilestone4: "",
		DailyItemPowersEpic1: "",
		DailyItemPowersEpic2: "",
		DailyItemPowersEpic3: "",
		DailyItemPowersEpicMilestone1: "",
		DailyItemPowersEpicMilestone2: "",
		DailyItemPowersEpicMilestone3: "",
		DailyItemPowersEpicMilestone4: "",

		Portrait: "",

		PersonalityTraits1: "",
		PersonalityTraits2: "",
		PersonalityTraits3: "",
		PersonalityTraits4: "",
		PersonalityTraits5: "",
		PersonalityTraits6: "",

		MannerismsAndAppearance1: "",
		MannerismsAndAppearance2: "",
		MannerismsAndAppearance3: "",
		MannerismsAndAppearance4: "",
		MannerismsAndAppearance5: "",
		MannerismsAndAppearance6: "",

		CharacterBackground2: "",
		CharacterBackground3: "",
		CharacterBackground4: "",

		CompanionsAndAlliesName1: "",
		CompanionsAndAlliesName2: "",
		CompanionsAndAlliesName3: "",
		CompanionsAndAlliesName4: "",
		CompanionsAndAlliesName5: "",
		CompanionsAndAlliesName6: "",
		CompanionsAndAlliesName7: "",
		CompanionsAndAlliesName8: "",

		CompanionsAndAlliesNotes1: "",
		CompanionsAndAlliesNotes2: "",
		CompanionsAndAlliesNotes3: "",
		CompanionsAndAlliesNotes4: "",
		CompanionsAndAlliesNotes5: "",
		CompanionsAndAlliesNotes6: "",
		CompanionsAndAlliesNotes7: "",
		CompanionsAndAlliesNotes8: "",

		OtherEquipment1: "",
		OtherEquipment2: "",
		OtherEquipment3: "",
		OtherEquipment4: "",
		OtherEquipment5: "",
		OtherEquipment6: "",
		OtherEquipment7: "",
		OtherEquipment8: "",
		OtherEquipment9: "",
		OtherEquipment10: "",

		Rituals1: "",
		Rituals2: "",
		Rituals3: "",
		Rituals4: "",
		Rituals5: "",
		Rituals6: "",
		Rituals7: "",
		Rituals8: "",
		Rituals9: "",
		Rituals10: "",
		SessionAndCampaignNotes1: "",
		SessionAndCampaignNotes2: "",
		SessionAndCampaignNotes3: "",
		SessionAndCampaignNotes4: "",
		SessionAndCampaignNotes5: "",
		SessionAndCampaignNotes6: "",
		SessionAndCampaignNotes7: "",
		SessionAndCampaignNotes8: "",
		SessionAndCampaignNotes9: "",
		SessionAndCampaignNotes10: "",
		SessionAndCampaignNotes11: "",
		SessionAndCampaignNotes12: "",
		CoinsAndOtherWealth: "",
	});
})();
