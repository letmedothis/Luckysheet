// 单元格右键菜单自定义项注册表。
// 约定：自定义项统一追加到 #luckysheet-rightclick-menu 末尾的独立分组；
// 该容器同时服务行列头菜单，故 showrightclickmenu 默认隐藏本分组，
// 仅在单元格区域右键分支(handler.js)调用 showCustomCellMenuItems() 时显示。

import Store from "../store";
import escapeHtml from "escape-html";

const GROUP_ID = "luckysheet-custom-cell-menu-group";

const items = []; // {id, name, order, hidden, onClick}
let seq = 0;

function currentContext() {
    let range =
        Store.luckysheet_select_save && Store.luckysheet_select_save.length
            ? Store.luckysheet_select_save[Store.luckysheet_select_save.length - 1]
            : {};
    let r = range.row_focus != null ? range.row_focus : range.row ? range.row[0] : null;
    let c = range.column_focus != null ? range.column_focus : range.column ? range.column[0] : null;
    return { r, c, range, ranges: Store.luckysheet_select_save, sheetIndex: Store.currentSheetIndex };
}

function itemVisible(item, ctx) {
    if (item.hidden == null) {
        return true;
    }
    return typeof item.hidden === "function" ? !item.hidden(ctx) : !item.hidden;
}

export function registerCellContextMenuItem(item) {
    if (item == null || typeof item.name !== "string" || typeof item.onClick !== "function") {
        console.warn("[luckysheet] registerCellContextMenuItem requires { name, onClick }");
        return null;
    }
    const id = item.id || "lk-cm-" + ++seq;
    if (items.some((it) => it.id === id)) {
        console.warn(`[luckysheet] cell context menu item "${id}" already registered`);
        return null;
    }
    items.push({ id, name: item.name, order: item.order ?? 0, hidden: item.hidden, onClick: item.onClick });
    items.sort((a, b) => a.order - b.order);
    syncCustomCellMenuDom(); // create 之后注册时立即生效
    return id;
}

export function unregisterCellContextMenuItem(id) {
    const i = items.findIndex((it) => it.id === id);
    if (i === -1) {
        return false;
    }
    items.splice(i, 1);
    syncCustomCellMenuDom();
    return true;
}

function groupHtml(ctx) {
    const visible = items.filter((it) => itemVisible(it, ctx));
    if (visible.length === 0) {
        return "";
    }
    let html = '<div class="luckysheet-menuseparator luckysheet-mousedown-cancel" role="separator"></div>';
    for (const it of visible) {
        html +=
            '<div class="luckysheet-cols-menuitem luckysheet-mousedown-cancel" data-lk-custom-cell-menu="' +
            it.id +
            '"><div class="luckysheet-cols-menuitem-content luckysheet-mousedown-cancel">' +
            escapeHtml(it.name) +
            "</div></div>";
    }
    return html;
}

function syncCustomCellMenuDom(ctx = currentContext()) {
    const $menu = $("#luckysheet-rightclick-menu");
    if (!$menu.length) {
        return $menu; // create() 尚未执行，菜单显示时再同步
    }
    let $group = $menu.children("#" + GROUP_ID);
    if (!$group.length) {
        $group = $('<div id="' + GROUP_ID + '" class="luckysheet-mousedown-cancel"></div>').appendTo($menu);
        $menu.on("click.luckysheetCustomCellMenu", "[data-lk-custom-cell-menu]", function () {
            const id = $(this).attr("data-lk-custom-cell-menu");
            const item = items.find((it) => it.id === id);
            if (item == null) {
                return;
            }
            $("#luckysheet-rightclick-menu").hide();
            try {
                item.onClick(currentContext());
            } catch (err) {
                console.error("[luckysheet] custom cell menu item error:", err);
            }
        });
    }
    $group.html(groupHtml(ctx));
    return $group;
}

// 单元格右键分支在 showrightclickmenu 之后调用：按当前选区刷新并显示自定义分组
export function showCustomCellMenuItems() {
    const $group = syncCustomCellMenuDom();
    if ($group && $group.length) {
        $group.css("display", "block");
    }
}

// 其他区域(行列头/透视表等)菜单显示时隐藏自定义分组，由 util.showrightclickmenu 调用
export function hideCustomCellMenuItems($menu) {
    const $group = ($menu || $("#luckysheet-rightclick-menu")).children("#" + GROUP_ID);
    $group.css("display", "none");
}
