let needle = require('needle')
let solsa = require('./solsa')

// FIXME: Streams.knative limitation -- must be in same namespace as the Streams.knative controller pod
//        So we hardwire that in the yaml and also hardwire a cross-NS service reference in all needle
//        calls from the wrapper service to the service in the streams NS that wraps the StreamsJob
const StreamsKNativeNS = 'streams'
const SVC_PORT = 8080

let streams = {
  StreamsJob: class StreamsJob extends solsa.Service {
    constructor (name, sab, submissionTimeValues) {
      super(name, true)
      this.name = name
      this.sab = sab
      this.submissionTimeValues = submissionTimeValues
      this.initialized = false
    }

    async _ensureInit () {
      if (this.initialized === false) {
        const opList = await this._retryingListOperators()
        for (let op of opList) {
          console.log('initializing ' + op)
          this[op] = async function () {
            const url = `http://${this.name}-svc` + '.' + StreamsKNativeNS + ':' + SVC_PORT + '/operator/' + op
            console.log('invoking StreamsJob: ' + url + ' ' + JSON.stringify(arguments[0]))
            return needle('put', url, arguments[0], { json: true })
              .then(result => result.body)
          }
        }
        this.initialized = true
      }
    }

    async _retryingListOperators () {
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
      while (true) {
        try {
          return await this._listOperators()
        } catch (err) {
          console.log('_retryingListOperators: StreamsJob not ready; waiting 1 second')
          await delay(1000)
        }
      }
    }

    async _listOperators () {
      const url = `http://${this.name}-svc` + '.' + StreamsKNativeNS + ':' + SVC_PORT + '/list'
      console.log('listOperators: ' + url)
      return needle('get', url, { json: true })
        .then(result => result.body.operators)
    }

    _yaml (archive, target, yamlDir) {
      const j = {
        apiVersion: 'streams.ibm.com/v1alpha1',
        kind: 'Job',
        metadata: {
          name: this.name,
          namespace: StreamsKNativeNS
        },
        spec: {
          processingElement: {
            imagePullPolicy: 'IfNotPresent',
            runtimeTraceLevel: 'DEBUG',
            sabName: this.sab,
            restartFailedPod: true
          },
          submissionTimeValues: this.submissionTimeValues
        }
      }
      archive.addYaml(j, this.name + '-job.yaml')

      const svc = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: this.name + '-svc',
          namespace: StreamsKNativeNS
        },
        spec: {
          ports: [{ port: SVC_PORT }],
          selector: {
            app: 'streams',
            svc: 'pe'
          }
        }
      }
      archive.addYaml(svc, this.name + '-svc.yaml')
    }
  }
}

module.exports = streams
