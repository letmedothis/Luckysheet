<template>
  <div :id="containerId" ref="root" class="luckysheet-host"></div>
</template>

<script>
import { loadLuckysheet } from "./luckysheet-loader";

let uid = 0;

export default {
  name: "Luckysheet",
  props: {
    // Passed straight to luckysheet.create(); `container` is managed by this component.
    options: { type: Object, default: () => ({}) },
    // Folder that contains the built Luckysheet assets.
    baseUrl: { type: String, default: "/luckysheet/" },
    // Auto-create on mount. Set false and call this.create() manually if needed.
    autoCreate: { type: Boolean, default: true },
    // Luckysheet keeps global singleton state; keep unique ids unless you
    // deliberately manage a single page-wide instance.
    uniqueId: { type: Boolean, default: true }
  },
  data() {
    return {
      containerId: this.uniqueId ? `luckysheet-${uid++}` : "luckysheet"
    };
  },
  mounted() {
    if (this.autoCreate) {
      this.create();
    }
  },
  // Vue 2
  beforeDestroy() {
    this.destroy();
  },
  // Vue 3
  beforeUnmount() {
    this.destroy();
  },
  methods: {
    /**
     * Create the sheet. Resolves with the luckysheet global instance.
     */
    async create(extraOptions) {
      const luckysheet = await loadLuckysheet(this.baseUrl);
      this._luckysheet = luckysheet;
      luckysheet.create(
        Object.assign({}, this.options, { container: this.containerId }, extraOptions || {})
      );
      this.$emit("created", luckysheet);
      return luckysheet;
    },
    /**
     * Destroy the current sheet and reset Luckysheet's global state.
     * Safe to call multiple times.
     */
    destroy() {
      if (this._luckysheet) {
        try {
          this._luckysheet.destroy();
        } catch (e) {
          // ignore: destroy may throw if the sheet was never fully created
        }
        this._luckysheet = null;
      }
    },
    /**
     * Access the underlying global object (e.g. toJson / getcellvalue).
     */
    getInstance() {
      return this._luckysheet || null;
    }
  }
};
</script>

<style>
.luckysheet-host {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
