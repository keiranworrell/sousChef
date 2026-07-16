# sousChef — Product Backlog

Roughly ordered by priority within each section. Cross off items as they ship.

---

## 🐛 Bugs

- [x] Shopping list generation from meal plan is broken
- [x] Pantry population from completed shopping list is broken

---

## 🎨 Small / UI changes

- [x] Confirm password field on sign-up form (enter twice for validation)
- [x] Move recipe importer inside the recipe creation form (not always at top of recipe list); include list of supported import sources
- [x] Add a source label/link on imported recipes pointing to the original URL
- [x] Show a "public" label or star on recipes the user has made public
- [x] Rearrange nav bar — move Fermentation into a dropdown (niche feature, declutters main nav)
- [x] Show creator name/label on community recipe cards
- [x] Search community recipes by user/creator

---

## 🔨 Medium features

- [x] Recipe tags — starter, main, dessert, baking, cuisine (Mexican, Italian, etc.) — usable for search and filter
- [x] Predictive tags based on ingredients (e.g. auto-flag vegetarian/vegan from ingredient list, likely via a simple rules pass or a cheap AI call)
- [x] Filter and sort on Recipes tab — by tag, difficulty, and sort order (newest/oldest/A–Z)
- [x] Recipe images — upload and store in S3, link in recipe record, display when recipe is loaded (S3 bucket already in infra plan)
- [x] Share button on recipes — generate a shareable link that opens the recipe for non-users (public recipes only)
- [x] My Profile page — display name, dietary requirements/preferences, profile bio, avatar
- [x] Add a "Rediscover" view — surfaces recipes you haven't made in a while / used to make regularly (based on cook history)
- [x] Add friends — follow/connect with other users
- [x] Ingredient substitution assistant — static substitution map; tap ingredient on recipe detail page or cooking mode to see substitutions and replace
- [x] "Add to shopping list" button on recipe view — adds all ingredients from a single recipe directly to an existing or new shopping list

---

## 🏗️ Large features

- [x] Shared shopping lists, meal plans, and pantries between friends
- [ ] Menus / Events — structured event planner with courses (starters, mains, desserts, drinks, canapés etc.), separate from the weekly meal plan
- [ ] Collaborative menus — share and co-edit an event menu with other users (build on top of Events above)
- [ ] Links to supermarket websites for ingredient prices / availability

---

## 💸 Paid tier / Far future

- [ ] Instagram / Pinterest recipe import — feed caption text (and possibly transcript) to AI to extract structured recipe data; inherently inconsistent so needs strict prompting and graceful fallback
- [ ] Pantry population from photo — take a photo of fridge/cupboard and have AI identify items; tricky accuracy problem
- [ ] Pantry population from barcode scan — scan a product barcode to add to pantry
- [ ] Recipe from photo — photograph a recipe card, Hello Fresh card, cookbook page etc. and extract the recipe via vision AI
- [ ] Cooking influencer integration — allow influencers to link recipes to sousChef, create public collections; requires platform maturity before this makes sense to pitch
- [ ] Cookbook integration — QR codes in physical cookbooks that unlock hidden recipes in the app; requires publisher/author deals

---

## 🗒️ Notes

- S3 bucket for recipe/fermentation images is already defined in the Terraform infra plan.
- AI agent stubs exist for substitution, scaling, dietary adaptation, fermentation troubleshoot, and recipe import — these are partially or fully unimplemented on the frontend.
- Follow/friends system is shipped — users can follow each other, view profiles, and share a household for collaborative pantry/shopping/meal plans.
- Tags are a prerequisite for meaningful filter/sort on recipes.
