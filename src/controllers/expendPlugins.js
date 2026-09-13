import { chart } from '../expendPlugins/chart/plugin'

const pluginsObj = {
    'chart':chart
}

const isDemo = true

/**
 * Register plugins
 * 
 * plugins:[
 * {name:'chart'}
 * ]
 */
function initPlugins(plugins , options){
    if(plugins.length){
        plugins.forEach(plugin => {
            pluginsObj[plugin.name](options, plugin.config, isDemo)
        });
    }
}

export {
    initPlugins
}