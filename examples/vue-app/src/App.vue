<template>
  <div id="app">
    <header>
      <h1>Luckysheet 双实例隔离测试</h1>
    </header>
    <main>
      <div class="sheet-container">
        <h3>实例 A</h3>
        <LuckysheetSheet
          :data="dataA"
          :options="optionsA"
          style="width: 100%; height: 50vh; border: 1px solid #ddd;"
          @ready="onReadyA"
          @error="onErrorA"
        />
      </div>
      <div class="sheet-container">
        <h3>实例 B</h3>
        <LuckysheetSheet
          :data="dataB"
          :options="optionsB"
          style="width: 100%; height: 50vh; border: 1px solid #ddd;"
          @ready="onReadyB"
          @error="onErrorB"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LuckysheetSheet from './components/luckysheet/LuckysheetSheet.vue';

const optionsA = {
  locale: 'zh-CN',
  readonly: false,
  showtoolbar: true,
  showsheetbar: true,
  showstatisticBar: true,
};

const dataA = ref({
  sheets: [
    {
      name: 'SheetA',
      celldata: [
        { r: 0, c: 0, v: '实例 A' },
        { r: 1, c: 0, v: '数据 A1' },
        { r: 1, c: 1, v: 100 },
      ],
    },
  ],
});

const optionsB = {
  locale: 'en',
  readonly: false,
  showtoolbar: true,
  showsheetbar: true,
  showstatisticBar: true,
};

const dataB = ref({
  sheets: [
    {
      name: 'SheetB',
      celldata: [
        { r: 0, c: 0, v: 'Instance B' },
        { r: 1, c: 0, v: 'Data B1' },
        { r: 1, c: 1, v: 200 },
      ],
    },
  ],
});

function onReadyA(instance: unknown) {
  console.log('实例 A 已创建', instance);
}

function onReadyB(instance: unknown) {
  console.log('实例 B 已创建', instance);
}

function onErrorA(error: Error) {
  console.error('实例 A 创建失败', error);
}

function onErrorB(error: Error) {
  console.error('实例 B 创建失败', error);
}
</script>

<style>
#app {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 20px;
}
header {
  margin-bottom: 20px;
}
h1 {
  margin: 0;
  font-size: 20px;
}
.sheet-container {
  margin-bottom: 20px;
}
h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
}
</style>
