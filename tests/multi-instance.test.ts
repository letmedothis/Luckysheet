import { createInstanceStore, useInstanceStore, getActiveStore, getGlobalState } from "../src/store";

console.log("=== 测试多实例隔离 ===");

// 创建两个实例 Store
const storeA = createInstanceStore("instance-a");
const storeB = createInstanceStore("instance-b");

// 切换并设置不同的数据
useInstanceStore(storeA);
getGlobalState().luckysheetCurrentRow = 10;
getGlobalState().testDataA = "A";

useInstanceStore(storeB);
getGlobalState().luckysheetCurrentRow = 20;
getGlobalState().testDataB = "B";

// 验证 A 的数据
useInstanceStore(storeA);
const aRow = getGlobalState().luckysheetCurrentRow;
const aData = getGlobalState().testDataA;
console.log("实例 A - row:", aRow, "testData:", aData);

// 验证 B 的数据
useInstanceStore(storeB);
const bRow = getGlobalState().luckysheetCurrentRow;
const bData = getGlobalState().testDataB;
console.log("实例 B - row:", bRow, "testData:", bData);

// 验证隔离性
const isolated = aRow === 10 && bRow === 20 && aData === "A" && bData === "B";
console.log("隔离验证:", isolated ? "✅ 通过" : "❌ 失败");

// 恢复默认 Store
useInstanceStore(createInstanceStore("default"));
console.log("=== 测试完成 ===");
