/**
 * Class selection component for character creation
 * Based on the StatGenUi patterns from statgen.html
 */
class CharacterCreatorClassSelector {
	constructor({parent, classes, modalFilterClasses}) {
		console.log("CharacterCreatorClassSelector constructor called with:", classes ? classes.length : 0, "classes");
		this._parent = parent;
		this._classes = classes || [];
		this._modalFilterClasses = modalFilterClasses;

		this._selectedClass = null;
		this._selectedSubclass = null;
		this._isPreview = false;

		// Modal filter is optional - we can work without it
		// if (!this._modalFilterClasses && typeof ModalFilterClasses !== 'undefined') {
		// 	this._modalFilterClasses = new ModalFilterClasses({
		// 		namespace: "character-creator.classes",
		// 		isRadio: true,
		// 		allData: this._classes
		// 	});
		// }
	}

	/**
	 * Initialize the component
	 */
	async pInit() {
		if (this._modalFilterClasses && this._modalFilterClasses.pPopulateHiddenWrapper) {
			await this._modalFilterClasses.pPopulateHiddenWrapper();
		}
	}

	/**
	 * Render the class selection interface
	 * @returns {Object} Object containing rendered elements
	 */
	render() {
		console.log("CharacterCreatorClassSelector.render() called");
		console.log("Classes available:", this._classes.length);
		console.log("jQuery available:", typeof $);
		console.log("Parser available:", typeof Parser);

		const $wrp = $(`<div class="ve-flex"></div>`);
		const $wrpOuter = $(`<div class="ve-flex-col">
			<div class="my-1 statgen-pb__header statgen-pb__header--group mr-3 ve-text-center italic ve-small help-subtle" title="Class Features and Proficiencies">Class</div>
		</div>`);
		$wrpOuter.append($wrp);

		// Simple class selection dropdown (fallback without ComponentUiUtil)
		const $selClass = $(`<select class="form-control input-xs form-control--minimal"></select>`);
		$selClass.append(`<option value="">Select a class...</option>`);

		console.log("Adding class options, classes:", this._classes);
		this._classes.forEach((cls, i) => {
			try {
				let sourceDisplay = "";
				if (cls.source && cls.source !== "PHB") {
					if (typeof Parser !== 'undefined' && Parser.sourceJsonToAbv) {
						sourceDisplay = ` [${Parser.sourceJsonToAbv(cls.source)}]`;
					} else {
						sourceDisplay = ` [${cls.source}]`;
					}
				}
				const displayName = `${cls.name}${sourceDisplay}`;
				console.log(`Adding class option ${i}: ${displayName}`);
				$selClass.append(`<option value="${i}">${displayName}</option>`);
			} catch (error) {
				console.error("Error creating class option:", cls, error);
				// Fallback to simple display
				$selClass.append(`<option value="${i}">${cls.name}</option>`);
			}
		});

		console.log("Class dropdown options added, total options:", $selClass.find('option').length);

		// Simple filter function (show all for now)
		const setFnFilterClass = (filterFn) => {
			// For now, just show all options
			console.log("Filter function set (not implemented yet)");
		};

		// Simple filtering without modal filter for now
		// TODO: Add back modal filter when dependencies are resolved
		const doApplyFilterToSelClass = () => {
			// For now, show all classes
			setFnFilterClass(() => true);
		};
		doApplyFilterToSelClass();

		// Filter button
		// Filter button (disabled for now)
		const $btnFilterForClass = $(`<button class="ve-btn ve-btn-xs ve-btn-default br-0 pr-2" title="Filter for Class (Coming Soon)" disabled><span class="glyphicon glyphicon-filter"></span> Filter</button>`);

		// Preview toggle button
		const $btnPreview = $(`<button class="ve-btn ve-btn-xs ve-btn-default" title="Toggle Class Preview"><span class="glyphicon glyphicon-eye-open"></span></button>`)
			.click(() => {
				this._isPreview = !this._isPreview;
				this._updatePreview();
			});

		// Subclass selection
		const $selSubclass = $(`<select class="form-control input-xs form-control--minimal"></select>`)
			.change(() => {
				const subclassName = $selSubclass.val();
				this._selectedSubclass = subclassName || null;
				this._parent._onClassSelectionChange && this._parent._onClassSelectionChange();
			});

		const $stgSubclass = $(`<div class="ve-flex-v-center mb-2" style="display: none;">
			<div class="mr-2 no-wrap">Subclass</div>
		</div>`);
		$stgSubclass.find('div:last').append($selSubclass);

		// Class selection stage
		const $stgSel = $(`<div class="ve-flex-col mt-3">
			<div class="mb-1">Select a Class</div>
		</div>`);

		const $selectionRow = $(`<div class="ve-flex-v-center mb-2"></div>`);
		const $btnGroup = $(`<div class="ve-flex-v-center ve-btn-group w-100 mr-2"></div>`);
		$btnGroup.append($btnFilterForClass, $selClass);
		$selectionRow.append($btnGroup, $(`<div></div>`).append($btnPreview));

		$stgSel.append($selectionRow, $stgSubclass);

		// Preview display
		const $dispPreview = $(`<div class="ve-flex-col mb-2" style="display: none;"></div>`);
		const $hrPreview = $(`<hr class="hr-3" style="display: none;">`);

		// Set up change handlers
		this._setupChangeHandlers($selClass, $selSubclass, $stgSubclass, $btnPreview, $dispPreview, $hrPreview);

		return {
			$wrpOuter,
			$stgSel,
			$dispPreview,
			$hrPreview,
		};
	}

	/**
	 * Set up change handlers for the UI elements
	 * @private
	 */
	_setupChangeHandlers($selClass, $selSubclass, $stgSubclass, $btnPreview, $dispPreview, $hrPreview) {
		// Handle class selection change
		$selClass.change(() => {
			const selectedValue = $selClass.val();
			const selectedIndex = parseInt(selectedValue);
			console.log("Class selection changed:", selectedValue, "->", selectedIndex);
			this.selectedClassIndex = isNaN(selectedIndex) ? null : selectedIndex;
		});

		// Update UI when class selection changes
		const updateClassSelection = () => {
			const cls = this.selectedClass;
			console.log("Updating class selection UI, selected class:", cls ? cls.name : "none");

			// Update preview button visibility
			$btnPreview.toggle(!!cls);

			// Update subclass options
			$selSubclass.empty().append(`<option value="">Select a subclass...</option>`);
			$stgSubclass.hide();

			if (cls && cls.subclasses && cls.subclasses.length > 0) {
				console.log("Class has subclasses:", cls.subclasses.length, cls.subclasses);
				cls.subclasses.forEach(subclass => {
					console.log("Adding subclass option:", subclass.name);
					$selSubclass.append(`<option value="${subclass.name}">${subclass.name}</option>`);
				});
				$stgSubclass.show();
			} else {
				console.log("Class has no subclasses or subclasses not found:", cls ? cls.name : "no class");
			}

			// Reset subclass selection
			this._selectedSubclass = null;

			// Update preview
			this._updatePreview($dispPreview, $hrPreview);

			// Notify parent of change
			if (this._parent._onClassSelectionChange) {
				this._parent._onClassSelectionChange();
			}
		};

		// Set up property for selectedClassIndex
		Object.defineProperty(this, 'selectedClassIndex', {
			get: () => this._selectedClassIndex,
			set: (value) => {
				console.log("Setting selectedClassIndex:", value);
				this._selectedClassIndex = value;
				this._selectedClass = value != null ? this._classes[value] : null;
				console.log("Selected class set to:", this._selectedClass ? this._selectedClass.name : "none");
				updateClassSelection();
			}
		});

		// Initialize
		updateClassSelection();
	}

	/**
	 * Update the preview display
	 * @private
	 */
	_updatePreview($dispPreview, $hrPreview) {
		console.log("_updatePreview called, isPreview:", this._isPreview, "selectedClass:", this.selectedClass ? this.selectedClass.name : "none");

		if (!$dispPreview || !$hrPreview) {
			// Find elements if not provided
			$dispPreview = $dispPreview || this._$dispPreview;
			$hrPreview = $hrPreview || this._$hrPreview;
		}

		if (!this._isPreview || !this.selectedClass) {
			console.log("Hiding preview - isPreview:", this._isPreview, "selectedClass:", !!this.selectedClass);
			if ($dispPreview) $dispPreview.hide();
			if ($hrPreview) $hrPreview.hide();
			return;
		}

		if ($dispPreview) {
			console.log("Showing preview for class:", this.selectedClass.name);
			$dispPreview.empty().show();

			try {
				// Use 5etools renderer to display class information
				console.log("Attempting to render class with Renderer.hover");
				const renderedClass = Renderer.hover.$getHoverContent_stats(UrlUtil.PG_CLASSES, this.selectedClass);
				$dispPreview.append(renderedClass);
				console.log("Class preview rendered successfully");
			} catch (error) {
				console.warn("Failed to render class preview:", error);
				$dispPreview.html(`
					<div class="alert alert-warning">
						<strong>${this.selectedClass.name}</strong>
						<p class="mb-0">Preview not available: ${error.message}</p>
					</div>
				`);
			}
		}

		if ($hrPreview) $hrPreview.show();
	}

	/**
	 * Get the currently selected class
	 */
	get selectedClass() {
		return this._selectedClass;
	}

	/**
	 * Get the currently selected subclass
	 */
	get selectedSubclass() {
		return this._selectedSubclass;
	}

	/**
	 * Set the selected class by name and source
	 */
	setSelectedClass(name, source) {
		const index = this._classes.findIndex(cls => cls.name === name && cls.source === source);
		this.selectedClassIndex = index >= 0 ? index : null;
	}

	/**
	 * Set the selected subclass by name
	 */
	setSelectedSubclass(name) {
		this._selectedSubclass = name;
		// Update UI if needed
	}

	/**
	 * Get class selection data for character creation
	 */
	getSelectionData() {
		if (!this.selectedClass) return null;

		return {
			class: {
				name: this.selectedClass.name,
				source: this.selectedClass.source
			},
			subclass: this._selectedSubclass ? {
				name: this._selectedSubclass,
				source: this.selectedClass.source // Assuming subclass has same source as class
			} : null
		};
	}

	/**
	 * Validate the current selection
	 */
	validate() {
		if (!this.selectedClass) {
			return {
				isValid: false,
				error: "Class selection is required"
			};
		}

		// Check if subclass is required but not selected
		if (this.selectedClass.subclasses && this.selectedClass.subclasses.length > 0 && !this._selectedSubclass) {
			return {
				isValid: false,
				error: "Subclass selection is required for this class"
			};
		}

		return {
			isValid: true,
			error: null
		};
	}
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
	module.exports = CharacterCreatorClassSelector;
} else if (typeof window !== "undefined") {
	window.CharacterCreatorClassSelector = CharacterCreatorClassSelector;
}
