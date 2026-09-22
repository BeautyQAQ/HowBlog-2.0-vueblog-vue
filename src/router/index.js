import Vue from 'vue'
import VueRouter from 'vue-router'
import store from '@/store'
import { Message } from 'element-ui'

import Home from '@/views/Home.vue'
import Login from '@/views/Login.vue'
import ArticleDetail from '@/views/ArticleDetail.vue'
import ArticleEdit from '@/views/ArticleEdit.vue'
import LabelManage from '@/views/LabelManage.vue'
import Chat from '@/views/Chat.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/article/create',
    name: 'ArticleCreate',
    component: ArticleEdit,
    meta: { requiresAuth: true }
  },
  {
    path: '/article/edit/:id',
    name: 'ArticleEdit',
    component: ArticleEdit,
    meta: { requiresAuth: true }
  },
  {
    path: '/article/:id',
    name: 'ArticleDetail',
    component: ArticleDetail
  },
  {
    path: '/labels',
    name: 'LabelManage',
    component: LabelManage,
    meta: { requiresAuth: true }
  },
  {
    path: '/chat',
    name: 'Chat',
    component: Chat,
    meta: { requiresAuth: true }
  },
  {
    path: '*',
    redirect: '/'
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

router.beforeEach(async (to, from, next) => {
  if (to.matched.some(record => record.meta && record.meta.requiresAuth)) {
    try {
      await store.dispatch('ensureSession')
    } catch (error) {
      Message.warning('登录已失效，请重新登录')
    }
    if (!store.getters.isLoggedIn) {
      Message.warning('该功能需要登录后访问')
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
    } else {
      next()
    }
  } else {
    next()
  }
})

store.watch(state => state.user, user => {
  if (!user && router.currentRoute.matched.some(record => record.meta.requiresAuth)) {
    router.replace({ path: '/login', query: { redirect: router.currentRoute.fullPath } })
  }
})

export default router
