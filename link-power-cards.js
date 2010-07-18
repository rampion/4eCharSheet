(function(){
	const image_urls=[ 
		"http://rampion.github.com/4eCharSheet/PowerCard-AtWill.png", 
		"http://rampion.github.com/4eCharSheet/PowerCard-Encounter.png", 
		"http://rampion.github.com/4eCharSheet/PowerCard-Daily.png"
	];
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
	[ '_AtWillPowers1', '_AtWillPowers2', '_AtWillPowers3', '_AtWillPowers4', '_AtWillPowers5', '_AtWillPowers6', 
		'_EncounterPowers1', '_EncounterPowers2', '_EncounterPowers3', '_EncounterPowers4', '_EncounterPowers5', '_EncounterPowers6', 
		'_DailyPowers1', '_DailyPowers2', '_DailyPowers3', '_DailyPowers4', '_DailyPowers5', '_DailyPowers6', 
		'_UtilityPowers1', '_UtilityPowers2', '_UtilityPowers3', '_UtilityPowers4', '_UtilityPowers5', '_UtilityPowers6', '_UtilityPowers7', '_UtilityPowers8', 
		'_MagicItemsWeapon1', '_MagicItemsWeapon2', '_MagicItemsWeapon3', '_MagicItemsWeapon4', '_MagicItemsArmor', '_MagicItemsArms', '_MagicItemsFeet', 
		'_MagicItemsHands', '_MagicItemsHead', '_MagicItemsNeck', '_MagicItemsRing1', '_MagicItemsRing2', '_MagicItemsWaist', 
		'_MagicItemsMisc1', '_MagicItemsMisc2', '_MagicItemsMisc3', '_MagicItemsMisc4', '_MagicItemsMisc5', '_MagicItemsMisc6', 
		'_MagicItemsMisc7', '_MagicItemsMisc8', '_MagicItemsMisc9', '_MagicItemsMisc10', '_MagicItemsMisc11', '_MagicItemsMisc12'
	].forEach(function(power_id){
		// autohide the power card depending on whether the power exists
		const power = document.getElementById(power_id);
		const power_card = document.getElementById(power_id + 'Card');
		const power_name = document.getElementById(power_id + 'Name');
		const power_type = document.getElementById(power_id + 'PowerType');
		power.addEventListener('change', function(change_event){
			power_card.style.display = /\S/.test(power.innerHTML) ? 'inline-block' : 'none';
			// for some reason, this displays wrong, so we'll fix it manually
			const opts = power_type.getElementsByTagName('option');
			for (i = 0; i < opts.length; i++){
				if (opts[i].selected) opts[i].selected = 'selected';
			}
		}, false);

		// coordinate the checkboxes, and tap the card if used
		const power_check = document.getElementById(power_id.replace(/\d/, 'Check$&'));
		const power_box = document.getElementById(power_id + 'Box');
		const check_change = function(change_event){
			if (power_check) power_check.checked = change_event.target.checked;
			power_box.checked = change_event.target.checked;
			(change_event.target.checked ? addClass : remClass)(power_card, "tapped");
		};
		if (power_check) power_check.addEventListener('change', check_change, false);
		power_box.addEventListener('change', check_change, false);
		
		// use the selection box to change the power type by changing the background image
		const power_image = document.getElementById(power_id + 'Image');
		power_type.addEventListener('change',function(e){ power_image.src=image_urls[e.target.value];},false);
	});
})();
