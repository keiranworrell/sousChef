/**
 * Static ingredient substitution map.
 *
 * Keys are lowercase ingredient keywords. Lookup normalises an ingredient name
 * to lowercase and checks whether any key is a substring of it, so "2 large
 * eggs" will match the "egg" key.
 *
 * Each substitution has a required `name` and an optional `notes` field that
 * gives brief guidance on using it.
 */

export type Substitution = {
  name: string;
  notes?: string;
};

/** Raw map: keyword → substitution options */
const SUBSTITUTION_MAP: Record<string, Substitution[]> = {
  // ── Dairy ────────────────────────────────────────────────────────────────
  butter: [
    { name: "Coconut oil", notes: "Use the same quantity; works well in baking" },
    { name: "Olive oil", notes: "Good for savoury cooking; use ¾ the amount" },
    { name: "Applesauce", notes: "In baking only; use equal amount, reduces fat" },
    { name: "Avocado", notes: "In baking; mash and use equal amount" },
    { name: "Margarine", notes: "1:1 swap; check it is dairy-free if needed" },
  ],
  "whole milk": [
    { name: "Oat milk", notes: "Closest texture; works in most recipes" },
    { name: "Almond milk", notes: "Lighter flavour; reduce sugar slightly if unsweetened" },
    { name: "Soy milk", notes: "Highest protein; best for savoury dishes" },
    { name: "Coconut milk (tin)", notes: "Richer result; good for creamy sauces and baking" },
    { name: "Rice milk", notes: "Mild flavour; thinner consistency" },
  ],
  milk: [
    { name: "Oat milk", notes: "Closest texture; works in most recipes" },
    { name: "Almond milk", notes: "Lighter flavour; reduce sugar slightly if unsweetened" },
    { name: "Soy milk", notes: "Highest protein; best for savoury dishes" },
    { name: "Coconut milk (tin)", notes: "Richer result; good for creamy sauces and baking" },
    { name: "Rice milk", notes: "Mild flavour; thinner consistency" },
  ],
  cream: [
    { name: "Coconut cream", notes: "Rich and thick; great in curries and desserts" },
    { name: "Cashew cream", notes: "Blend soaked cashews with water; neutral flavour" },
    { name: "Evaporated milk", notes: "Lower fat; good for sauces" },
    { name: "Full-fat oat milk", notes: "Works in most sauces; slightly thinner" },
  ],
  "sour cream": [
    { name: "Greek yoghurt", notes: "1:1 swap; tangier but similar texture" },
    { name: "Coconut cream", notes: "Dairy-free; slightly sweeter" },
    { name: "Crème fraîche", notes: "Richer; use the same amount" },
  ],
  "cream cheese": [
    { name: "Ricotta", notes: "Lighter texture; works well in baking" },
    { name: "Cashew cream cheese", notes: "Blend soaked cashews with lemon juice; dairy-free" },
    { name: "Mascarpone", notes: "Richer; great for desserts" },
  ],
  "heavy cream": [
    { name: "Coconut cream", notes: "Full-fat tin; shaken well; 1:1 swap" },
    { name: "Evaporated milk", notes: "Works in sauces; won't whip" },
    { name: "Cashew cream", notes: "Blend soaked cashews; neutral flavour" },
  ],
  yoghurt: [
    { name: "Sour cream", notes: "1:1 swap; slightly richer" },
    { name: "Coconut yoghurt", notes: "Dairy-free; similar tang" },
    { name: "Buttermilk", notes: "In baking; thinner, adjust liquid accordingly" },
  ],
  cheese: [
    { name: "Nutritional yeast", notes: "Sprinkle on top for savoury, cheesy flavour" },
    { name: "Vegan cheese", notes: "Melts differently; taste varies by brand" },
    { name: "Tofu (firm, crumbled)", notes: "In fillings; season well with nutritional yeast" },
  ],
  parmesan: [
    { name: "Nutritional yeast", notes: "Sprinkle 1–2 tbsp per 30 g parmesan; great umami flavour" },
    { name: "Pecorino Romano", notes: "Saltier; use slightly less" },
    { name: "Grana Padano", notes: "Milder; 1:1 swap" },
  ],
  mozzarella: [
    { name: "Provolone", notes: "Melts well; mild flavour" },
    { name: "Vegan mozzarella", notes: "Stretches less but looks similar" },
    { name: "Havarti", notes: "Creamy and mild; melts well" },
  ],
  buttermilk: [
    { name: "Milk + lemon juice", notes: "240 ml milk + 1 tbsp lemon juice, rest 5 min" },
    { name: "Milk + white vinegar", notes: "240 ml milk + 1 tbsp vinegar, rest 5 min" },
    { name: "Plain yoghurt thinned with milk", notes: "Mix 180 ml yoghurt + 60 ml milk" },
  ],

  // ── Eggs ─────────────────────────────────────────────────────────────────
  egg: [
    { name: "Flax egg", notes: "1 tbsp ground flaxseed + 3 tbsp water, rest 5 min; best in cookies and muffins" },
    { name: "Chia egg", notes: "1 tbsp chia seeds + 3 tbsp water, rest 5 min; slightly gelatinous" },
    { name: "Aquafaba", notes: "3 tbsp tin chickpea liquid per egg; great for meringues" },
    { name: "Applesauce", notes: "¼ cup per egg; adds moisture, subtle sweetness" },
    { name: "Mashed banana", notes: "¼ cup per egg; adds sweetness and banana flavour" },
    { name: "Silken tofu (blended)", notes: "¼ cup per egg; works well in dense bakes" },
    { name: "Commercial egg replacer", notes: "Follow packet instructions; reliable all-rounder" },
  ],

  // ── Sweeteners ───────────────────────────────────────────────────────────
  "white sugar": [
    { name: "Honey", notes: "Use ¾ the amount; reduce liquid in recipe by 3 tbsp per cup" },
    { name: "Maple syrup", notes: "Use ¾ the amount; reduce liquid slightly" },
    { name: "Coconut sugar", notes: "1:1 swap; slightly caramel flavour, less processed" },
    { name: "Brown sugar", notes: "1:1 swap; adds slight molasses note" },
    { name: "Agave nectar", notes: "Use ⅔ the amount; reduce liquid slightly" },
  ],
  "caster sugar": [
    { name: "Granulated white sugar (blended)", notes: "Blitz briefly to refine the crystals" },
    { name: "Coconut sugar (blended)", notes: "Blitz finely; slightly darker result" },
  ],
  "brown sugar": [
    { name: "White sugar + molasses", notes: "1 cup white sugar + 1 tbsp molasses; mix well" },
    { name: "Coconut sugar", notes: "1:1 swap; slightly less sweet" },
    { name: "Maple syrup", notes: "Use ¾ the amount; reduce liquid in recipe" },
  ],
  honey: [
    { name: "Maple syrup", notes: "1:1 swap; thinner consistency, milder flavour" },
    { name: "Agave nectar", notes: "1:1 swap; more neutral flavour; vegan" },
    { name: "Golden syrup", notes: "1:1 swap; sweeter and thicker" },
    { name: "Date syrup", notes: "1:1 swap; adds depth; less refined" },
  ],
  "maple syrup": [
    { name: "Honey", notes: "1:1 swap; slightly thicker" },
    { name: "Agave nectar", notes: "1:1 swap; neutral flavour; vegan" },
    { name: "Date syrup", notes: "1:1 swap; more complex, less sweet" },
  ],

  // ── Flours & Starches ────────────────────────────────────────────────────
  "plain flour": [
    { name: "Almond flour", notes: "Use 1:1 but result will be denser and moister; not ideal for bread" },
    { name: "Oat flour", notes: "Blend rolled oats; works well in pancakes and muffins" },
    { name: "Rice flour", notes: "Gluten-free; good for batters and shortbread" },
    { name: "Gluten-free plain flour blend", notes: "1:1 swap; most reliable GF option" },
    { name: "Spelt flour", notes: "Similar but nuttier; not gluten-free" },
  ],
  "all-purpose flour": [
    { name: "Almond flour", notes: "Use 1:1 but result will be denser and moister" },
    { name: "Oat flour", notes: "Blend rolled oats; works well in pancakes and muffins" },
    { name: "Rice flour", notes: "Gluten-free; good for batters" },
    { name: "Gluten-free plain flour blend", notes: "1:1 swap; most reliable GF option" },
    { name: "Spelt flour", notes: "Similar but nuttier; not gluten-free" },
  ],
  flour: [
    { name: "Almond flour", notes: "Use 1:1 but result will be denser and moister" },
    { name: "Oat flour", notes: "Blend rolled oats; works in most quick breads" },
    { name: "Gluten-free plain flour blend", notes: "1:1 swap; check blend includes xanthan gum" },
  ],
  "bread flour": [
    { name: "Plain flour", notes: "Lower protein; loaf will be slightly less chewy" },
    { name: "Spelt flour", notes: "Lower gluten; slightly denser loaf" },
  ],
  cornstarch: [
    { name: "Arrowroot powder", notes: "1:1 swap; clearer sauces; doesn't withstand long cooking" },
    { name: "Tapioca starch", notes: "1:1 swap; slightly chewier texture" },
    { name: "Plain flour", notes: "Use 2 tbsp flour per 1 tbsp cornstarch; opaque result" },
    { name: "Rice flour", notes: "1:1 swap; slightly grainy if undercooked" },
  ],
  "corn starch": [
    { name: "Arrowroot powder", notes: "1:1 swap; clearer sauces" },
    { name: "Tapioca starch", notes: "1:1 swap; slightly chewier" },
    { name: "Plain flour", notes: "Use 2 tbsp flour per 1 tbsp cornstarch" },
  ],

  // ── Oils & Fats ──────────────────────────────────────────────────────────
  "olive oil": [
    { name: "Avocado oil", notes: "High smoke point; neutral flavour; great for cooking" },
    { name: "Coconut oil", notes: "Adds slight coconut note; solid at room temperature" },
    { name: "Rapeseed oil", notes: "Neutral flavour; good all-rounder" },
    { name: "Sunflower oil", notes: "Neutral flavour; light texture" },
  ],
  "vegetable oil": [
    { name: "Sunflower oil", notes: "1:1 swap; very neutral" },
    { name: "Rapeseed oil", notes: "1:1 swap; slightly nutty" },
    { name: "Avocado oil", notes: "1:1 swap; high smoke point" },
    { name: "Coconut oil (melted)", notes: "1:1 swap; adds subtle coconut flavour" },
  ],
  "coconut oil": [
    { name: "Butter", notes: "1:1 swap; adds dairy richness" },
    { name: "Vegetable oil", notes: "1:1 swap in cooking; won't solidify" },
    { name: "Avocado oil", notes: "1:1 swap; neutral flavour" },
  ],
  "sesame oil": [
    { name: "Toasted sesame oil (less)", notes: "Use ½ the amount; more intense" },
    { name: "Peanut oil", notes: "Neutral with slight nuttiness" },
    { name: "Walnut oil", notes: "Nutty flavour; use same amount" },
  ],

  // ── Proteins ─────────────────────────────────────────────────────────────
  "chicken breast": [
    { name: "Chicken thigh (boneless)", notes: "Juicier; cook to same internal temperature (74 °C / 165 °F)" },
    { name: "Turkey breast", notes: "Lean; similar cooking time" },
    { name: "Firm tofu", notes: "Press and marinate well; pan-fry or bake" },
    { name: "Tempeh", notes: "Nuttier; marinate and slice; holds up well to grilling" },
  ],
  "chicken thigh": [
    { name: "Chicken breast", notes: "Leaner; reduce cooking time slightly" },
    { name: "Duck leg", notes: "Richer flavour; longer cooking time" },
    { name: "Tempeh", notes: "Marinate and grill or braise for similar hearty texture" },
  ],
  "minced beef": [
    { name: "Minced lamb", notes: "Richer flavour; 1:1 swap" },
    { name: "Minced turkey", notes: "Leaner; season well" },
    { name: "Minced pork", notes: "Fattier; richer result" },
    { name: "Lentils (cooked)", notes: "Plant-based; 240 g cooked lentils per 250 g mince" },
    { name: "Mushrooms (finely chopped)", notes: "Blend with lentils for best texture" },
    { name: "Soy mince", notes: "1:1 swap; rehydrate before using" },
  ],
  "ground beef": [
    { name: "Ground lamb", notes: "Richer flavour; 1:1 swap" },
    { name: "Ground turkey", notes: "Leaner; season well" },
    { name: "Ground pork", notes: "Fattier; richer result" },
    { name: "Cooked lentils", notes: "240 g cooked lentils per 250 g beef" },
  ],
  "minced lamb": [
    { name: "Minced beef", notes: "Milder flavour; 1:1 swap" },
    { name: "Minced pork", notes: "Milder; works well in Middle Eastern dishes" },
  ],
  bacon: [
    { name: "Pancetta", notes: "Italian-cured; similar flavour and texture" },
    { name: "Lardons", notes: "Pre-cut; same cured flavour" },
    { name: "Turkey bacon", notes: "Leaner; less fat rendered" },
    { name: "Smoked tofu", notes: "Dice and pan-fry; plant-based smoky flavour" },
    { name: "Coconut bacon", notes: "Bake coconut flakes with smoked paprika; vegan" },
  ],
  "firm tofu": [
    { name: "Tempeh", notes: "Denser and nuttier; great for grilling and stir-fry" },
    { name: "Chicken breast", notes: "If not vegan; press and marinate similarly" },
    { name: "Chickpeas", notes: "In curries and stews; add near end of cooking" },
    { name: "Halloumi", notes: "Grills well; salty; use less added salt" },
  ],
  salmon: [
    { name: "Trout", notes: "Similar flavour and cooking time; slightly milder" },
    { name: "Mackerel", notes: "Stronger flavour; oily fish" },
    { name: "Sea bass", notes: "Leaner; more delicate" },
    { name: "Tuna steak", notes: "Meaty; cook to medium for best texture" },
  ],
  "cod fillet": [
    { name: "Haddock", notes: "Similar mild flavour and flaky texture; 1:1 swap" },
    { name: "Pollock", notes: "Budget-friendly; similar texture" },
    { name: "Tilapia", notes: "Mild; works well in batters" },
    { name: "Sea bass", notes: "More flavourful; slightly more expensive" },
  ],

  // ── Aromatics & Alliums ──────────────────────────────────────────────────
  garlic: [
    { name: "Garlic powder", notes: "⅛ tsp per clove; less pungent when raw" },
    { name: "Garlic paste (jarred)", notes: "1 tsp per clove; convenient" },
    { name: "Asafoetida (hing)", notes: "Pinch per clove; very strong — start small" },
    { name: "Shallot", notes: "Milder allium flavour; use 1 small shallot per clove" },
  ],
  onion: [
    { name: "Shallots", notes: "Milder and sweeter; use 3 shallots per 1 medium onion" },
    { name: "Leek", notes: "Milder; white and light green parts only" },
    { name: "Spring onions", notes: "Add raw or cook briefly; milder" },
    { name: "Onion powder", notes: "1 tsp per medium onion; for cooked dishes" },
    { name: "Fennel bulb", notes: "Milder; adds slight anise note" },
  ],
  shallot: [
    { name: "Red onion", notes: "Slightly more pungent; use half a small onion per shallot" },
    { name: "White onion", notes: "Milder; use sparingly" },
    { name: "Spring onions", notes: "Milder; use the white parts" },
  ],
  leek: [
    { name: "Onion", notes: "Stronger flavour; use half a medium onion per leek" },
    { name: "Spring onions", notes: "Milder; use a bunch per leek" },
    { name: "Fennel bulb", notes: "Different flavour but similar texture when cooked" },
  ],
  ginger: [
    { name: "Ground ginger", notes: "¼ tsp ground per 1 tsp fresh; less bright flavour" },
    { name: "Galangal", notes: "Similar root; more citrusy and piney" },
    { name: "Mace", notes: "Very different but warms spice mixes similarly" },
  ],

  // ── Fresh Herbs ───────────────────────────────────────────────────────────
  parsley: [
    { name: "Coriander", notes: "Brighter, citrusy; different flavour profile" },
    { name: "Basil", notes: "Sweeter; good in Italian dishes" },
    { name: "Chervil", notes: "Closest substitute; delicate anise note" },
    { name: "Dried parsley", notes: "Use ⅓ the amount; less vibrant" },
  ],
  basil: [
    { name: "Fresh mint", notes: "Brighter; works in salads and some pasta" },
    { name: "Dried basil", notes: "Use ⅓ the amount; less vibrant" },
    { name: "Thai basil", notes: "Anise note; great in Asian dishes" },
    { name: "Oregano", notes: "Earthier; works in Italian sauces" },
  ],
  coriander: [
    { name: "Parsley", notes: "Milder; for those who dislike coriander" },
    { name: "Thai basil", notes: "Works in Asian dishes; different flavour" },
    { name: "Dried coriander", notes: "Use ⅓ the amount of fresh" },
  ],
  rosemary: [
    { name: "Thyme", notes: "Earthier; good in roasts and braises" },
    { name: "Oregano", notes: "Milder; dried works well" },
    { name: "Dried rosemary", notes: "Use ⅓ the amount of fresh" },
  ],
  thyme: [
    { name: "Oregano", notes: "Slightly stronger; works in most applications" },
    { name: "Marjoram", notes: "Milder and sweeter; great substitute" },
    { name: "Dried thyme", notes: "Use ⅓ the amount of fresh" },
  ],
  mint: [
    { name: "Fresh basil", notes: "Sweeter; works in salads" },
    { name: "Dried mint", notes: "Use ⅓ the amount; less vibrant" },
    { name: "Spearmint", notes: "Milder; 1:1 swap" },
  ],
  chives: [
    { name: "Spring onion greens", notes: "Slice finely; similar onion flavour" },
    { name: "Leek tops", notes: "Chop finely; milder" },
    { name: "Dried chives", notes: "Use ⅓ the amount" },
  ],

  // ── Dried Spices ─────────────────────────────────────────────────────────
  "smoked paprika": [
    { name: "Sweet paprika + chipotle powder", notes: "½ tsp sweet paprika + pinch chipotle" },
    { name: "Ancho chilli powder", notes: "Slightly different but adds smokiness" },
    { name: "Sweet paprika + liquid smoke", notes: "Add a drop or two of liquid smoke" },
  ],
  paprika: [
    { name: "Ancho chilli powder", notes: "Slightly more heat; similar earthy flavour" },
    { name: "Cayenne (small amount)", notes: "Much hotter; use ¼ the amount" },
    { name: "Tomato powder", notes: "Milder; less colourful" },
  ],
  cumin: [
    { name: "Caraway seeds (ground)", notes: "Earthy and warm; slightly different but close" },
    { name: "Chilli powder blend", notes: "Contains cumin; adjust other spices" },
    { name: "Coriander (ground)", notes: "Citrusy; different flavour family" },
  ],
  "chilli powder": [
    { name: "Smoked paprika + cayenne", notes: "Mix equal parts; adjust cayenne to taste" },
    { name: "Chipotle powder", notes: "Smokier; similar heat level" },
    { name: "Ancho chilli powder", notes: "Milder; deeper flavour" },
  ],
  "cayenne pepper": [
    { name: "Chilli flakes", notes: "Use equal amount; slightly different heat distribution" },
    { name: "Hot sauce", notes: "Add to taste; adds liquid" },
    { name: "Jalapeño powder", notes: "Milder heat; similar flavour" },
  ],
  turmeric: [
    { name: "Saffron", notes: "More complex; adds similar golden colour; use a pinch" },
    { name: "Annatto powder", notes: "Adds colour with mild flavour; less bitter" },
    { name: "Curry powder", notes: "Contains turmeric; adjust other spices" },
  ],
  "cinnamon": [
    { name: "Mixed spice", notes: "Contains cinnamon; use same amount" },
    { name: "Allspice", notes: "Warmer and more complex; use ½ the amount" },
    { name: "Nutmeg + cardamom", notes: "Combine for warmth; start with small amounts" },
  ],
  nutmeg: [
    { name: "Mace", notes: "Closest substitute; same flavour family" },
    { name: "Allspice", notes: "More complex; use same amount" },
    { name: "Cinnamon", notes: "Sweeter and less warm; works in baking" },
  ],
  "vanilla extract": [
    { name: "Vanilla bean paste", notes: "1:1 swap; visible seeds, richer flavour" },
    { name: "Vanilla pod (seeds)", notes: "Seeds of 1 pod ≈ 1 tsp extract; more intense" },
    { name: "Almond extract", notes: "Use ½ the amount; nutty and sweet" },
    { name: "Maple syrup", notes: "Adds sweetness and warmth; use same amount" },
  ],

  // ── Acids & Liquids ───────────────────────────────────────────────────────
  "lemon juice": [
    { name: "Lime juice", notes: "1:1 swap; slightly different flavour" },
    { name: "White wine vinegar", notes: "½ the amount; more acidic" },
    { name: "Apple cider vinegar", notes: "½ the amount; slight apple note" },
    { name: "Orange juice", notes: "Less acidic; adds sweetness" },
  ],
  "lime juice": [
    { name: "Lemon juice", notes: "1:1 swap; slightly less floral" },
    { name: "White wine vinegar", notes: "½ the amount; more acidic" },
    { name: "Tamarind paste", notes: "In Asian dishes; tangy and complex" },
  ],
  "white wine": [
    { name: "Chicken stock", notes: "Adds savouriness without alcohol" },
    { name: "Apple juice", notes: "Adds sweetness; use same amount" },
    { name: "White wine vinegar + water", notes: "1 tbsp vinegar + 3 tbsp water per ¼ cup wine" },
    { name: "Vegetable stock", notes: "Neutral; good in risotto and braises" },
  ],
  "red wine": [
    { name: "Beef stock", notes: "Rich and savoury; adds depth" },
    { name: "Pomegranate juice", notes: "Fruity and tangy; use same amount" },
    { name: "Red wine vinegar + water", notes: "1 tbsp vinegar + 3 tbsp water per ¼ cup wine" },
    { name: "Grape juice", notes: "Sweeter; reduces less sharply" },
  ],
  "soy sauce": [
    { name: "Tamari", notes: "Gluten-free; 1:1 swap; slightly richer" },
    { name: "Coconut aminos", notes: "Soy-free; slightly sweeter; 1:1 swap" },
    { name: "Worcestershire sauce", notes: "Adds depth; different flavour; use half" },
    { name: "Fish sauce (small amount)", notes: "Intense umami; use ¼ the amount" },
  ],
  "fish sauce": [
    { name: "Soy sauce + lime juice", notes: "2 tsp soy + ½ tsp lime juice per tsp fish sauce" },
    { name: "Coconut aminos + lime", notes: "Soy-free version" },
    { name: "Worcestershire sauce", notes: "Similar umami; not vegan" },
  ],
  "worcestershire sauce": [
    { name: "Soy sauce", notes: "Less complex; use same amount" },
    { name: "Balsamic vinegar + soy", notes: "½ balsamic + ½ soy; adds depth" },
    { name: "Coconut aminos", notes: "Slightly sweeter; soy-free option" },
  ],
  "apple cider vinegar": [
    { name: "White wine vinegar", notes: "1:1 swap; slightly less fruity" },
    { name: "Lemon juice", notes: "1:1 swap; citrusy" },
    { name: "Rice vinegar", notes: "Milder; 1:1 swap" },
  ],
  "balsamic vinegar": [
    { name: "Red wine vinegar + honey", notes: "1 tbsp red wine vinegar + ½ tsp honey" },
    { name: "Pomegranate molasses", notes: "Sweet and tangy; 1:1 swap" },
    { name: "Fig jam thinned with vinegar", notes: "Similar depth; sweeter" },
  ],

  // ── Grains & Pasta ────────────────────────────────────────────────────────
  rice: [
    { name: "Quinoa", notes: "Higher protein; cook in stock for more flavour" },
    { name: "Cauliflower rice", notes: "Low-carb; blend raw cauliflower and pan-fry" },
    { name: "Couscous", notes: "Much faster to cook; lighter texture" },
    { name: "Bulgur wheat", notes: "Nutty; good in salads and pilafs" },
    { name: "Orzo", notes: "Pasta shape; cooks like rice" },
  ],
  pasta: [
    { name: "Rice noodles", notes: "Gluten-free; great in Asian-style dishes" },
    { name: "Courgette noodles (zoodles)", notes: "Low-carb; spiralise raw courgette" },
    { name: "Chickpea pasta", notes: "Gluten-free and higher protein; similar cooking time" },
    { name: "Lentil pasta", notes: "Higher protein; slightly denser" },
    { name: "Spaghetti squash", notes: "Low-carb; roast and scrape with fork" },
  ],
  breadcrumbs: [
    { name: "Panko breadcrumbs", notes: "Lighter and crispier; 1:1 swap" },
    { name: "Crushed crackers", notes: "Use the same amount; adds slight saltiness" },
    { name: "Ground almonds", notes: "Gluten-free; adds richness; 1:1 swap" },
    { name: "Rolled oats (blended)", notes: "Gluten-free option; texture varies" },
  ],
  oats: [
    { name: "Quinoa flakes", notes: "Similar texture in baking; slightly nuttier" },
    { name: "Buckwheat flakes", notes: "Gluten-free; slightly stronger flavour" },
    { name: "Millet flakes", notes: "Mild flavour; gluten-free" },
  ],

  // ── Pulses & Legumes ──────────────────────────────────────────────────────
  chickpeas: [
    { name: "Cannellini beans", notes: "Milder; good in salads and stews" },
    { name: "Butter beans", notes: "Creamy; great in Mediterranean dishes" },
    { name: "Lentils", notes: "Earthier; break down more in cooking" },
  ],
  lentils: [
    { name: "Split peas", notes: "Similar cooking time; slightly different texture" },
    { name: "Chickpeas (cooked)", notes: "Firmer; doesn't break down as much" },
    { name: "Black beans", notes: "Firmer; good in soups and stews" },
  ],
  "black beans": [
    { name: "Kidney beans", notes: "Firmer; slightly different flavour" },
    { name: "Pinto beans", notes: "Creamy; good in Mexican dishes" },
    { name: "Lentils", notes: "Break down more; good in soups" },
  ],

  // ── Nuts & Seeds ──────────────────────────────────────────────────────────
  "pine nuts": [
    { name: "Cashews (chopped)", notes: "Creamy; toast lightly for best flavour" },
    { name: "Pumpkin seeds", notes: "Cheaper; great toasted" },
    { name: "Sunflower seeds", notes: "Milder; budget-friendly" },
    { name: "Walnuts (chopped)", notes: "Stronger flavour; good in pasta and salads" },
  ],
  walnuts: [
    { name: "Pecans", notes: "Sweeter; 1:1 swap" },
    { name: "Almonds (chopped)", notes: "Crunchier; milder" },
    { name: "Cashews", notes: "Creamier; milder flavour" },
  ],
  almonds: [
    { name: "Cashews", notes: "Creamier; milder; 1:1 swap" },
    { name: "Macadamia nuts", notes: "Buttery; richer" },
    { name: "Sunflower seeds", notes: "Nut-free alternative; milder" },
  ],
  tahini: [
    { name: "Almond butter", notes: "Sweeter; thicker; works in sauces and dressings" },
    { name: "Sunflower seed butter", notes: "Nut-free; similar consistency" },
    { name: "Cashew butter", notes: "Milder; creamier" },
  ],
  "peanut butter": [
    { name: "Almond butter", notes: "1:1 swap; slightly milder flavour" },
    { name: "Cashew butter", notes: "Creamier; sweeter" },
    { name: "Sunflower seed butter", notes: "Nut-free; similar consistency" },
    { name: "Tahini", notes: "Sesame flavour; thinner; works in sauces and baking" },
  ],

  // ── Vegetables ───────────────────────────────────────────────────────────
  courgette: [
    { name: "Yellow squash", notes: "Very similar; 1:1 swap" },
    { name: "Cucumber", notes: "Raw only; watery; no cooking substitute" },
    { name: "Aubergine", notes: "Absorbs flavours well; cook until soft" },
  ],
  aubergine: [
    { name: "Courgette", notes: "Less absorbent; slightly different texture" },
    { name: "Portobello mushrooms", notes: "Meaty texture; great grilled or roasted" },
    { name: "Butternut squash", notes: "Sweeter; works in Middle Eastern dishes" },
  ],
  "spinach": [
    { name: "Kale", notes: "Tougher; massage or cook longer" },
    { name: "Swiss chard", notes: "Slightly earthier; cooks similarly" },
    { name: "Rocket", notes: "Peppery; use raw or just wilted" },
    { name: "Watercress", notes: "Peppery; use raw in salads" },
  ],
  kale: [
    { name: "Spinach", notes: "Softer; wilts faster" },
    { name: "Swiss chard", notes: "Similar heartiness; remove tough stems" },
    { name: "Cavolo nero", notes: "Very similar; slightly sweeter" },
  ],
  mushroom: [
    { name: "Portobello mushroom", notes: "Meatier; great for burgers and grilling" },
    { name: "Dried mushrooms (rehydrated)", notes: "More intense umami; 30 g dried ≈ 200 g fresh" },
    { name: "Aubergine", notes: "Absorbs flavours; different texture" },
    { name: "Courgette", notes: "Milder; won't add same umami" },
  ],
  "sweet potato": [
    { name: "Butternut squash", notes: "Sweeter and drier; roasts well" },
    { name: "Pumpkin", notes: "Similar sweetness; works in soups and roasts" },
    { name: "Regular potato", notes: "Less sweet; versatile" },
    { name: "Parsnip", notes: "Sweeter than potato; caramelises well" },
  ],
  "bell pepper": [
    { name: "Poblano pepper", notes: "Mild heat; earthy flavour" },
    { name: "Courgette (chopped)", notes: "Different flavour but similar texture when cooked" },
    { name: "Roasted red pepper (jarred)", notes: "Soft and smoky; use in cooked dishes" },
  ],

  // ── Stock & Sauces ────────────────────────────────────────────────────────
  "chicken stock": [
    { name: "Vegetable stock", notes: "Lighter; great in risottos and soups" },
    { name: "Mushroom stock", notes: "Adds umami depth" },
    { name: "Water + miso paste", notes: "1 tsp miso per 240 ml water; savoury umami base" },
    { name: "Dashi", notes: "Japanese base; adds depth to Asian dishes" },
  ],
  "beef stock": [
    { name: "Mushroom stock", notes: "Rich umami depth; plant-based" },
    { name: "Vegetable stock + tomato paste", notes: "Adds body; 1 tbsp tomato paste per 240 ml" },
    { name: "Red wine + vegetable stock", notes: "50/50 blend; adds complexity" },
  ],
  "vegetable stock": [
    { name: "Chicken stock", notes: "Richer flavour; not vegetarian" },
    { name: "Mushroom stock", notes: "Adds umami; plant-based" },
    { name: "Water + miso", notes: "Quick substitute; 1 tsp miso per 240 ml water" },
  ],
  "tomato paste": [
    { name: "Tomato purée (concentrated further)", notes: "Reduce 3 tbsp purée per 1 tbsp paste" },
    { name: "Sun-dried tomato paste", notes: "Stronger flavour; use same amount" },
    { name: "Ketchup", notes: "Sweeter; use in small amounts" },
    { name: "Roasted red peppers (blended)", notes: "Milder; adds body" },
  ],
  "coconut milk": [
    { name: "Cashew cream", notes: "Blend soaked cashews with water; neutral" },
    { name: "Oat cream", notes: "Lighter; good in soups and curries" },
    { name: "Evaporated milk", notes: "Not vegan; similar creaminess" },
    { name: "Soy creamer", notes: "Lighter body; good in curries" },
  ],
  "tinned tomatoes": [
    { name: "Fresh tomatoes (chopped)", notes: "Less concentrated; simmer longer" },
    { name: "Passata", notes: "Smoother; reduce cooking time" },
    { name: "Sun-dried tomatoes + water", notes: "More intense flavour; rehydrate first" },
  ],
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Look up substitutions for an ingredient by name.
 * Normalises to lowercase and checks if any map key is contained in the name.
 * Returns the first (most specific) match found, or an empty array.
 */
export function getSubstitutions(ingredientName: string): Substitution[] {
  const normalised = ingredientName.toLowerCase();

  // Prefer longer (more specific) key matches first
  const sortedKeys = Object.keys(SUBSTITUTION_MAP).sort(
    (a, b) => b.length - a.length,
  );

  for (const key of sortedKeys) {
    if (normalised.includes(key)) {
      return SUBSTITUTION_MAP[key] ?? [];
    }
  }

  return [];
}

/**
 * Returns true when the ingredient has at least one known substitution.
 */
export function hasSubstitutions(ingredientName: string): boolean {
  return getSubstitutions(ingredientName).length > 0;
}
