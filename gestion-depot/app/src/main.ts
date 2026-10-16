import '@fontsource-variable/manrope'
import './app.css'
import './documents.css'
import { mount } from 'svelte'
import App from './App.svelte'

const app = mount(App, { target: document.getElementById('app')! })

export default app
