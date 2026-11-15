import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { loadFonts } from './engine/font_service'
import './styles.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// 字体后台预载，完成后文字对象可在下次编辑时转曲线
void loadFonts()
