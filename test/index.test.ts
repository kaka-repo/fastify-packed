import Fastify from 'fastify'
import t from 'tap'
import FastifyPacked, { createPackedPlugin } from '../lib'

t.plan(2)
t.test('no options', function (t) {
  t.plan(1)
  t.test('should pass', async function (t) {
    t.plan(1)
    const fastify = Fastify()
    await fastify.register(FastifyPacked)
    await fastify.ready()
    t.pass()
  })
})

t.test('createPackedPlugin', function (t) {
  t.plan(1)
  t.test('should pass', async function (t) {
    t.plan(1)
    const fastify = Fastify()
    const { plugin } = createPackedPlugin()
    await fastify.register(plugin)
    await fastify.ready()
    t.pass()
  })
})
