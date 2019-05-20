# SolSA

The SolSA library for Node.js makes it possible to specify the architecture of
cloud-native solutions as programs. Using SolSA, a developer can enumerate and
configure all the components of a solution including resources such as managed
cloud services, cloud functions, containerized services, Knative services and
event sources.

SolSA leverages Kubernetes operators to define and configure these resources
whether they run inside or outside of a Kubernetes cluster. SolSA relies on the
[composable operator](https://github.ibm.com/seed/composable) to encode dynamic dependencies between resource
configurations.

The execution of the SolSA code produces yaml than can be fed directly into
`kubectl` to deploy the solution. SolSA leverages `kustomize` to permit
targeting multiple environments, e.g., local development cluster, IKS or ICP
cluster.

SolSA enables the specification of repeatable architectural patterns that can be
reused across many solutions. SolSA supports expressing dependencies on shared
resources. SolSA simplifies the configuration of related resources such as a
Kafka instance, a Kafka topic, and a Knative Kafka event source.

The SolSA code is much more compact and less error-prone than the equivalent
yaml. The yaml generated by SolSA can be deployed at once, i.e., with a single
`kubectl apply` command. There is no need for separate steps or manual inputs
during deployment.

SolSA includes an optional capability to containerize Node.js code. This
facilitates the integration of components that require a little bit of glue code
to interface properly, e.g., to align schemas or match protocols. This glue code
can leverage portable Node.js frameworks such as `express` or `kafkajs`. SolSA
builds the container image and synthesizes the yaml to instantiate the image
with the proper configuration.

## Components

SolSA consists of:
- A main `solsa` module that provides a library of high-level abstractions for
  defining the software architecture of a solution.
- Helper tools:
  - `solsa-build` builds and pushes container images for SolSA-defined services.
  - `solsa-yaml` synthesizes "Kustomizable" yaml for deploying SolSA solutions
     on Kubernetes.

## Configure a Kubernetes Cluster for SolSA

### Cluster-wide Setup

1. Install SEED. Follow the instructions at https://github.ibm.com/seed/charts.

2. Optionally install Knative. For IKS, follow the instructions at
   https://cloud.ibm.com/docs/containers?topic=containers-knative_tutorial#knative_tutorial.

   NOTE: There is a bug in the IKS installation of Knative 0.4.1 that results in
   a misconfigured istio ingress. After installing Knative, execute `kubectl
   edit ing iks-knative-ingress -n istio-system` and change
   `_place_holder_for_ingress_secret` to the real value of your Ingress Secret
   obtained via `bx cs cluster-get <MY_CLUSTER_NAME>`

### Per Namespace Setup

1. Create an image pull secret for the IBM Container Registry.

2. Edit the namespace's default service account to add the secret to the list of
   imagePullSecrets.

## Local Setup

1. Configure `kubectl` to access your Kubernetes cluster(s).

2. Login to the IBM container registry if any of your clusters are IKS clusters.

3. Create a `.solsa.yaml` file in your home directory that describes each
   Kubernetes cluster for which you want SolSA to generate a Kustomize overlay.
   The example file below defines two deployment environments, a local dev
   environment that uses a NodePort ingress and an IKS cluster.
   ```yaml
   clusters:
   - name: 'localdev'
     ingress:
       nodePort: 32323
   - name: 'mycluster'
     ingress:
       iks:
         subdomain: 'mycluster123.us-east.containers.appdomain.cloud'
         tlssecret: 'mycluster123'
     registry: 'us.icr.io/tardieu'
     images:
     - name: solsa-translator
       newName: us.icr.io/groved/solsa-translator
   ```
   The IKS cluster definition demonstrates how to instruct SolSA to generate a
   Kustomize overlay that will rename docker images so that instead of being
   pulled from the local registry on the dev machine, the images will instead be
   pulled from a specific namespace in the IBM Container Registry. Specific
   images can also be handled. A default registry can also be specified.

4. Clone and initialize this repository:
   ```sh
   git clone https://github.ibm.com/solsa/solsa.git
   cd solsa
   npm install
   npm link
   ```

## Examples

The [solsa-examples](https://github.ibm.com/solsa/solsa-examples) repository
contains sample cloud native applications and architectural patterns defined
using SolSA.

A SolSA application `myApp.js` can be built and deployed to the IKS cluster
`mycluster` defined above by using `solsa-build`, `solsa-yaml` and `kubectl`
(v1.14) as shown below.
```shell
sosla-build --push mycluster myApp.js
sosla-yaml -o myApp myApp.js
tar xzf myApp.tgz
kubectl apply -k myApp/mycluster
```
To undeploy the application, use the command
```shell
kubectl delete -k myApp/mycluster
```

Note that `kustomize` support was recently added to `kubectl` in version 1.14.
With older versions of `kubectl` you will need to install a standalone
`kustomize` cli and instead do:
```shell
kustomize build myApp/mycluster | kubectl apply -f -
```
or
```shell
kustomize build myApp/mycluster | kubectl delete -f -
```
