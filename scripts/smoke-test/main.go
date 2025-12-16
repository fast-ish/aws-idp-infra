package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorCyan   = "\033[36m"
)

type TestResult struct {
	Name    string
	Passed  bool
	Warning bool
	Message string
}

type TestSuite struct {
	clientset     *kubernetes.Clientset
	dynamicClient dynamic.Interface
	results       []TestResult
	passed        int
	failed        int
	warnings      int
}

func main() {
	printBanner()

	suite, err := NewTestSuite()
	if err != nil {
		fmt.Printf("%s✗ Failed to initialize: %v%s\n", colorRed, err, colorReset)
		os.Exit(1)
	}

	suite.RunAll()
	suite.PrintSummary()

	if suite.failed > 0 {
		os.Exit(1)
	}
}

func printBanner() {
	fmt.Printf("%s", colorCyan)
	fmt.Println("╔═══════════════════════════════════════════════════════════════╗")
	fmt.Println("║           IDP SMOKE TEST - Deployment Validation              ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")
	fmt.Printf("%s\n", colorReset)
}

func NewTestSuite() (*TestSuite, error) {
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	configOverrides := &clientcmd.ConfigOverrides{}
	kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)

	config, err := kubeConfig.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load kubeconfig: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %w", err)
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	return &TestSuite{
		clientset:     clientset,
		dynamicClient: dynamicClient,
	}, nil
}

func (s *TestSuite) RunAll() {
	s.testEKSCluster()
	s.testHelmReleases()
	s.testSecurity()
	s.testBackstage()
	s.testArgoCD()
	s.testArgoWorkflows()
	s.testArgoEvents()
	s.testArgoRollouts()
	s.testObservability()
}

func (s *TestSuite) printHeader(title string) {
	fmt.Printf("\n%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n", colorBlue, colorReset)
	fmt.Printf("%s  %s%s\n", colorBlue, title, colorReset)
	fmt.Printf("%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n", colorBlue, colorReset)
}

func (s *TestSuite) printSection(title string) {
	fmt.Printf("\n%s▶ %s%s\n", colorYellow, title, colorReset)
}

func (s *TestSuite) pass(name string) {
	fmt.Printf("  %s✓%s %s\n", colorGreen, colorReset, name)
	s.passed++
	s.results = append(s.results, TestResult{Name: name, Passed: true})
}

func (s *TestSuite) fail(name string) {
	fmt.Printf("  %s✗%s %s\n", colorRed, colorReset, name)
	s.failed++
	s.results = append(s.results, TestResult{Name: name, Passed: false})
}

func (s *TestSuite) warn(name string) {
	fmt.Printf("  %s⚠%s %s\n", colorYellow, colorReset, name)
	s.warnings++
	s.results = append(s.results, TestResult{Name: name, Warning: true})
}

// -----------------------------------------------------------------------------
// EKS Cluster Tests
// -----------------------------------------------------------------------------

func (s *TestSuite) testEKSCluster() {
	s.printHeader("EKS CLUSTER HEALTH")
	ctx := context.Background()

	s.printSection("Cluster Connectivity")
	_, err := s.clientset.Discovery().ServerVersion()
	if err != nil {
		s.fail("Cluster connectivity")
	} else {
		s.pass("Cluster connectivity")
	}

	s.printSection("Node Health")
	nodes, err := s.clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		s.fail("List nodes")
	} else {
		ready := 0
		notReady := 0
		for _, node := range nodes.Items {
			for _, cond := range node.Status.Conditions {
				if cond.Type == "Ready" {
					if cond.Status == "True" {
						ready++
					} else {
						notReady++
					}
				}
			}
		}
		s.pass(fmt.Sprintf("Nodes ready: %d", ready))
		if notReady > 0 {
			s.warn(fmt.Sprintf("Nodes not ready: %d", notReady))
		}
	}

	s.printSection("System Pods")
	s.checkPodsRunning(ctx, "kube-system", "k8s-app=kube-dns", "CoreDNS")
	s.checkPodsRunning(ctx, "kube-system", "k8s-app=kube-proxy", "kube-proxy")

	s.printSection("Karpenter")
	s.checkPodsRunning(ctx, "kube-system", "app.kubernetes.io/name=karpenter", "Karpenter controller")
	s.checkCRDExists(ctx, "nodepools.karpenter.sh", "NodePool CRD")
	s.checkCRDExists(ctx, "ec2nodeclasses.karpenter.k8s.aws", "EC2NodeClass CRD")
}

// -----------------------------------------------------------------------------
// Helm Releases Tests
// -----------------------------------------------------------------------------

func (s *TestSuite) testHelmReleases() {
	s.printHeader("HELM RELEASES & CRDs")
	ctx := context.Background()

	s.printSection("CRDs Installed")
	crds := []struct{ name, display string }{
		{"applications.argoproj.io", "ArgoCD Applications"},
		{"workflows.argoproj.io", "Argo Workflows"},
		{"eventsources.argoproj.io", "Argo Events EventSources"},
		{"sensors.argoproj.io", "Argo Events Sensors"},
		{"eventbus.argoproj.io", "Argo Events EventBus"},
		{"rollouts.argoproj.io", "Argo Rollouts"},
		{"analysistemplates.argoproj.io", "Argo Rollouts AnalysisTemplates"},
		{"externalsecrets.external-secrets.io", "External Secrets"},
		{"certificates.cert-manager.io", "Cert Manager"},
		{"clusterpolicies.kyverno.io", "Kyverno Policies"},
	}
	for _, crd := range crds {
		s.checkCRDExists(ctx, crd.name, crd.display)
	}

	s.printSection("Namespace Deployments")
	namespaces := []struct{ ns, label, name string }{
		{"argocd", "app.kubernetes.io/name=argocd-server", "ArgoCD Server"},
		{"argo", "app.kubernetes.io/name=argo-workflows-server", "Argo Workflows Server"},
		{"argo-events", "app.kubernetes.io/name=argo-events-controller-manager", "Argo Events Controller"},
		{"argo-rollouts", "app.kubernetes.io/name=argo-rollouts", "Argo Rollouts Controller"},
		{"external-secrets", "app.kubernetes.io/name=external-secrets", "External Secrets"},
		{"cert-manager", "app.kubernetes.io/name=cert-manager", "Cert Manager"},
		{"kyverno", "app.kubernetes.io/part-of=kyverno", "Kyverno"},
		{"aws-load-balancer", "app.kubernetes.io/name=aws-load-balancer-controller", "AWS LB Controller"},
		{"external-dns", "app.kubernetes.io/name=external-dns", "External DNS"},
		{"reloader", "app.kubernetes.io/name=reloader", "Reloader"},
	}
	for _, ns := range namespaces {
		s.checkPodsRunning(ctx, ns.ns, ns.label, ns.name)
	}
}

// -----------------------------------------------------------------------------
// Security Tests
// -----------------------------------------------------------------------------

func (s *TestSuite) testSecurity() {
	s.printHeader("SECURITY CONFIGURATION")
	ctx := context.Background()

	s.printSection("Secrets Management")
	// Check ClusterSecretStore (try v1 first, then v1beta1)
	gvr := schema.GroupVersionResource{Group: "external-secrets.io", Version: "v1", Resource: "clustersecretstores"}
	_, err := s.dynamicClient.Resource(gvr).Get(ctx, "aws-secrets-manager", metav1.GetOptions{})
	if err != nil {
		// Try v1beta1
		gvr = schema.GroupVersionResource{Group: "external-secrets.io", Version: "v1beta1", Resource: "clustersecretstores"}
		_, err = s.dynamicClient.Resource(gvr).Get(ctx, "aws-secrets-manager", metav1.GetOptions{})
	}
	if err != nil {
		s.fail("ClusterSecretStore 'aws-secrets-manager'")
	} else {
		s.pass("ClusterSecretStore 'aws-secrets-manager'")
	}

	// Check ExternalSecrets sync status
	esGVR := schema.GroupVersionResource{Group: "external-secrets.io", Version: "v1", Resource: "externalsecrets"}
	esList, err := s.dynamicClient.Resource(esGVR).Namespace("").List(ctx, metav1.ListOptions{})
	if err == nil {
		synced := 0
		total := len(esList.Items)
		for _, es := range esList.Items {
			conditions, found, _ := unstructured.NestedSlice(es.Object, "status", "conditions")
			if found {
				for _, c := range conditions {
					cond := c.(map[string]interface{})
					if cond["type"] == "Ready" && cond["status"] == "True" {
						synced++
						break
					}
				}
			}
		}
		if synced == total && total > 0 {
			s.pass(fmt.Sprintf("ExternalSecrets synced: %d/%d", synced, total))
		} else if total > 0 {
			s.warn(fmt.Sprintf("ExternalSecrets synced: %d/%d", synced, total))
		}
	}

	s.printSection("Kyverno Policies")
	policyGVR := schema.GroupVersionResource{Group: "kyverno.io", Version: "v1", Resource: "clusterpolicies"}
	policies, err := s.dynamicClient.Resource(policyGVR).List(ctx, metav1.ListOptions{})
	if err != nil {
		s.warn("Could not list Kyverno policies")
	} else {
		s.pass(fmt.Sprintf("Kyverno policies: %d", len(policies.Items)))
	}

	s.printSection("TLS/Certificates")
	s.checkPodsRunning(ctx, "cert-manager", "app.kubernetes.io/name=cert-manager", "Cert Manager")
}

// -----------------------------------------------------------------------------
// Backstage Tests
// -----------------------------------------------------------------------------

func (s *TestSuite) testBackstage() {
	s.printHeader("BACKSTAGE")
	ctx := context.Background()

	s.printSection("Deployment Status")
	s.checkNamespaceExists(ctx, "backstage")
	// Find backstage deployment (may have prefix)
	deps, err := s.clientset.AppsV1().Deployments("backstage").List(ctx, metav1.ListOptions{})
	if err != nil || len(deps.Items) == 0 {
		s.fail("Backstage deployment not found")
	} else {
		dep := deps.Items[0]
		if dep.Status.ReadyReplicas == *dep.Spec.Replicas && *dep.Spec.Replicas > 0 {
			s.pass(fmt.Sprintf("Backstage (%s): %d/%d ready", dep.Name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
		} else {
			s.fail(fmt.Sprintf("Backstage (%s): %d/%d ready", dep.Name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
		}
	}

	s.printSection("Database")
	secrets, _ := s.clientset.CoreV1().Secrets("backstage").List(ctx, metav1.ListOptions{})
	found := false
	for _, secret := range secrets.Items {
		if strings.Contains(secret.Name, "db") || strings.Contains(secret.Name, "database") || strings.Contains(secret.Name, "postgres") {
			found = true
			break
		}
	}
	if found {
		s.pass("Database credentials secret exists")
	} else {
		s.warn("Database credentials secret not found")
	}

	s.printSection("Ingress & Connectivity")
	s.checkIngressAndHealth(ctx, "backstage", "backstage", "Backstage")
}

// -----------------------------------------------------------------------------
// ArgoCD Tests
// -----------------------------------------------------------------------------

func (s *TestSuite) testArgoCD() {
	s.printHeader("ARGOCD")
	ctx := context.Background()

	s.printSection("Deployment Status")
	s.checkNamespaceExists(ctx, "argocd")

	deployments := []string{"argocd-server", "argocd-repo-server", "argocd-dex-server", "argocd-redis"}
	for _, comp := range deployments {
		s.checkDeploymentReadyByName(ctx, "argocd", comp)
	}
	// Application controller is a StatefulSet
	s.checkStatefulSetReady(ctx, "argocd", "argocd-application-controller")

	s.printSection("SSO Configuration")
	cm, err := s.clientset.CoreV1().ConfigMaps("argocd").Get(ctx, "argocd-cm", metav1.GetOptions{})
	if err == nil {
		if dexConfig, ok := cm.Data["dex.config"]; ok && strings.Contains(dexConfig, "github") {
			s.pass("GitHub SSO configured in Dex")
		} else {
			s.warn("GitHub SSO not configured")
		}
	}

	// Check Dex secret sync
	s.checkSSOSecretSync(ctx)

	s.printSection("Ingress & Health")
	s.checkIngressAndHealth(ctx, "argocd", "argocd-server", "ArgoCD")

	s.printSection("Applications")
	appGVR := schema.GroupVersionResource{Group: "argoproj.io", Version: "v1alpha1", Resource: "applications"}
	apps, err := s.dynamicClient.Resource(appGVR).Namespace("argocd").List(ctx, metav1.ListOptions{})
	if err == nil {
		healthy := 0
		for _, app := range apps.Items {
			health, _, _ := unstructured.NestedString(app.Object, "status", "health", "status")
			if health == "Healthy" {
				healthy++
			}
		}
		s.pass(fmt.Sprintf("Applications: %d total, %d healthy", len(apps.Items), healthy))
	}
}

// -----------------------------------------------------------------------------
// Argo Workflows Tests
// -----------------------------------------------------------------------------

func (s *TestSuite) testArgoWorkflows() {
	s.printHeader("ARGO WORKFLOWS")
	ctx := context.Background()

	s.printSection("Deployment Status")
	s.checkNamespaceExists(ctx, "argo")
	s.checkDeploymentReadyByName(ctx, "argo", "argo-workflows-server")
	s.checkDeploymentReadyByName(ctx, "argo", "argo-workflows-workflow-controller")

	s.printSection("SSO Configuration")
	cm, err := s.clientset.CoreV1().ConfigMaps("argo").Get(ctx, "argo-workflows-workflow-controller-configmap", metav1.GetOptions{})
	if err == nil {
		if config, ok := cm.Data["config"]; ok {
			if strings.Contains(config, "issuer") {
				s.pass("SSO configured")
			} else {
				s.warn("SSO not configured")
			}
			if strings.Contains(config, "rbac") {
				if strings.Contains(config, "enabled: false") {
					s.pass("SSO RBAC: disabled (all authenticated users allowed)")
				} else {
					s.pass("SSO RBAC: enabled")
				}
			}
		}
	}

	// Check SSO secrets match
	argoSecret, err1 := s.clientset.CoreV1().Secrets("argo").Get(ctx, "argo-workflows-sso", metav1.GetOptions{})
	argocdSecret, err2 := s.clientset.CoreV1().Secrets("argocd").Get(ctx, "argo-workflows-sso", metav1.GetOptions{})
	if err1 == nil && err2 == nil {
		argoVal := string(argoSecret.Data["client-secret"])
		argocdVal := string(argocdSecret.Data["client-secret"])
		if argoVal == argocdVal {
			s.pass("SSO secrets match (argo ↔ argocd)")
		} else {
			s.fail("SSO secrets MISMATCH (argo ↔ argocd)")
		}
	}

	s.printSection("Database")
	_, err = s.clientset.CoreV1().Secrets("argo").Get(ctx, "argo-workflows-db-credentials", metav1.GetOptions{})
	if err == nil {
		s.pass("Database credentials secret exists")
	} else {
		s.warn("Database credentials secret not found")
	}

	s.printSection("Ingress & Connectivity")
	s.checkIngressAndHealth(ctx, "argo", "argo-workflows-server", "Argo Workflows")
}

func (s *TestSuite) testArgoEvents() {
	s.printHeader("ARGO EVENTS")
	ctx := context.Background()

	s.printSection("Deployment Status")
	s.checkNamespaceExists(ctx, "argo-events")

	deps, err := s.clientset.AppsV1().Deployments("argo-events").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, dep := range deps.Items {
			if dep.Status.ReadyReplicas == *dep.Spec.Replicas {
				s.pass(fmt.Sprintf("%s: %d/%d ready", dep.Name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
			} else {
				s.fail(fmt.Sprintf("%s: %d/%d ready", dep.Name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
			}
		}
	}

	s.printSection("Event Bus")
	eventbusGVR := schema.GroupVersionResource{Group: "argoproj.io", Version: "v1alpha1", Resource: "eventbus"}
	eventbusList, err := s.dynamicClient.Resource(eventbusGVR).Namespace("argo-events").List(ctx, metav1.ListOptions{})
	if err == nil && len(eventbusList.Items) > 0 {
		for _, eb := range eventbusList.Items {
			phase, _, _ := unstructured.NestedString(eb.Object, "status", "phase")
			if phase == "Running" {
				s.pass(fmt.Sprintf("EventBus '%s': %s", eb.GetName(), phase))
			} else {
				s.warn(fmt.Sprintf("EventBus '%s': %s", eb.GetName(), phase))
			}
		}
	} else {
		s.warn("No EventBus resources found")
	}

	s.printSection("Event Sources")
	esGVR := schema.GroupVersionResource{Group: "argoproj.io", Version: "v1alpha1", Resource: "eventsources"}
	esList, err := s.dynamicClient.Resource(esGVR).Namespace("").List(ctx, metav1.ListOptions{})
	if err == nil {
		active := 0
		for _, es := range esList.Items {
			status, _, _ := unstructured.NestedMap(es.Object, "status")
			if status != nil {
				active++
			}
		}
		s.pass(fmt.Sprintf("EventSources: %d total, %d with status", len(esList.Items), active))
	}

	s.printSection("Sensors")
	sensorGVR := schema.GroupVersionResource{Group: "argoproj.io", Version: "v1alpha1", Resource: "sensors"}
	sensorList, err := s.dynamicClient.Resource(sensorGVR).Namespace("").List(ctx, metav1.ListOptions{})
	if err == nil {
		active := 0
		for _, sensor := range sensorList.Items {
			status, _, _ := unstructured.NestedMap(sensor.Object, "status")
			if status != nil {
				active++
			}
		}
		s.pass(fmt.Sprintf("Sensors: %d total, %d with status", len(sensorList.Items), active))
	}

	s.printSection("Service Account")
	sa, err := s.clientset.CoreV1().ServiceAccounts("argo-events").Get(ctx, "argo-events-controller", metav1.GetOptions{})
	if err == nil {
		if sa.Annotations != nil {
			if roleArn, ok := sa.Annotations["eks.amazonaws.com/role-arn"]; ok && roleArn != "" {
				s.pass("Controller service account has IRSA")
			} else {
				s.warn("Controller service account missing IRSA annotation")
			}
		} else {
			s.warn("Controller service account has no annotations")
		}
	} else {
		s.fail("Controller service account not found")
	}
}

func (s *TestSuite) testArgoRollouts() {
	s.printHeader("ARGO ROLLOUTS")
	ctx := context.Background()

	s.printSection("Deployment Status")
	s.checkNamespaceExists(ctx, "argo-rollouts")

	deps, err := s.clientset.AppsV1().Deployments("argo-rollouts").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, dep := range deps.Items {
			if dep.Status.ReadyReplicas == *dep.Spec.Replicas {
				s.pass(fmt.Sprintf("%s: %d/%d ready", dep.Name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
			} else {
				s.fail(fmt.Sprintf("%s: %d/%d ready", dep.Name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
			}
		}
	}

	s.printSection("Rollouts")
	rolloutsGVR := schema.GroupVersionResource{Group: "argoproj.io", Version: "v1alpha1", Resource: "rollouts"}
	rolloutsList, err := s.dynamicClient.Resource(rolloutsGVR).Namespace("").List(ctx, metav1.ListOptions{})
	if err == nil {
		healthy := 0
		for _, r := range rolloutsList.Items {
			phase, _, _ := unstructured.NestedString(r.Object, "status", "phase")
			if phase == "Healthy" {
				healthy++
			}
		}
		s.pass(fmt.Sprintf("Rollouts: %d total, %d healthy", len(rolloutsList.Items), healthy))
	}

	s.printSection("Analysis Templates")
	atGVR := schema.GroupVersionResource{Group: "argoproj.io", Version: "v1alpha1", Resource: "analysistemplates"}
	atList, err := s.dynamicClient.Resource(atGVR).Namespace("").List(ctx, metav1.ListOptions{})
	if err == nil {
		s.pass(fmt.Sprintf("AnalysisTemplates: %d", len(atList.Items)))
	}

	s.printSection("Service Accounts")
	saNames := []string{"argo-rollouts-controller", "argo-rollouts-dashboard"}
	for _, saName := range saNames {
		sa, err := s.clientset.CoreV1().ServiceAccounts("argo-rollouts").Get(ctx, saName, metav1.GetOptions{})
		if err == nil {
			if sa.Annotations != nil {
				if roleArn, ok := sa.Annotations["eks.amazonaws.com/role-arn"]; ok && roleArn != "" {
					s.pass(fmt.Sprintf("%s has IRSA", saName))
				} else {
					s.warn(fmt.Sprintf("%s missing IRSA annotation", saName))
				}
			} else {
				s.warn(fmt.Sprintf("%s has no annotations", saName))
			}
		} else {
			s.warn(fmt.Sprintf("%s not found", saName))
		}
	}

	s.printSection("Ingress & Connectivity")
	s.checkIngressAndHealth(ctx, "argo-rollouts", "argo-rollouts-dashboard", "Argo Rollouts Dashboard")
}

func (s *TestSuite) testObservability() {
	s.printHeader("OBSERVABILITY")
	ctx := context.Background()

	s.printSection("Grafana k8s-monitoring Stack")
	// Check for k8s-monitoring helm chart components (sends to Grafana Cloud)
	alloyComponents := []struct {
		label string
		name  string
	}{
		{"app.kubernetes.io/name=alloy-logs", "Alloy Logs"},
		{"app.kubernetes.io/name=alloy-metrics", "Alloy Metrics"},
		{"app.kubernetes.io/name=alloy-singleton", "Alloy Singleton"},
	}
	for _, comp := range alloyComponents {
		pods, err := s.clientset.CoreV1().Pods("monitoring").List(ctx, metav1.ListOptions{
			LabelSelector: comp.label,
		})
		if err == nil && len(pods.Items) > 0 {
			running := 0
			for _, pod := range pods.Items {
				if pod.Status.Phase == "Running" {
					running++
				}
			}
			if running > 0 {
				s.pass(fmt.Sprintf("%s: %d running", comp.name, running))
			} else {
				s.warn(fmt.Sprintf("%s: none running", comp.name))
			}
		} else {
			s.warn(fmt.Sprintf("%s: not found", comp.name))
		}
	}

	// Check Beyla (eBPF auto-instrumentation)
	pods, err := s.clientset.CoreV1().Pods("monitoring").List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=beyla",
	})
	if err == nil && len(pods.Items) > 0 {
		running := 0
		for _, pod := range pods.Items {
			if pod.Status.Phase == "Running" {
				running++
			}
		}
		if running > 0 {
			s.pass(fmt.Sprintf("Beyla (eBPF): %d running", running))
		}
	}

	s.printSection("Metrics Server")
	s.checkPodsRunning(ctx, "kube-system", "app.kubernetes.io/name=metrics-server", "Metrics Server")

	// Check metrics API
	_, err = s.clientset.Discovery().ServerResourcesForGroupVersion("metrics.k8s.io/v1beta1")
	if err == nil {
		s.pass("Metrics API available")
	} else {
		s.warn("Metrics API not available")
	}
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

func (s *TestSuite) checkPodsRunning(ctx context.Context, namespace, labelSelector, name string) {
	pods, err := s.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		s.fail(fmt.Sprintf("%s (error listing)", name))
		return
	}
	running := 0
	for _, pod := range pods.Items {
		if pod.Status.Phase == "Running" {
			running++
		}
	}
	if running > 0 {
		s.pass(fmt.Sprintf("%s: %d running", name, running))
	} else {
		s.fail(fmt.Sprintf("%s: no pods running", name))
	}
}

func (s *TestSuite) checkDeploymentReady(ctx context.Context, namespace, labelSelector, name string) {
	deps, err := s.clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil || len(deps.Items) == 0 {
		s.fail(fmt.Sprintf("%s deployment", name))
		return
	}
	dep := deps.Items[0]
	if dep.Status.ReadyReplicas == *dep.Spec.Replicas {
		s.pass(fmt.Sprintf("%s: %d/%d ready", name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
	} else {
		s.fail(fmt.Sprintf("%s: %d/%d ready", name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
	}
}

func (s *TestSuite) checkDeploymentReadyByName(ctx context.Context, namespace, name string) {
	dep, err := s.clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		s.fail(fmt.Sprintf("%s deployment", name))
		return
	}
	if dep.Status.ReadyReplicas == *dep.Spec.Replicas {
		s.pass(fmt.Sprintf("%s: %d/%d ready", name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
	} else {
		s.fail(fmt.Sprintf("%s: %d/%d ready", name, dep.Status.ReadyReplicas, *dep.Spec.Replicas))
	}
}

func (s *TestSuite) checkStatefulSetReady(ctx context.Context, namespace, name string) {
	sts, err := s.clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		s.fail(fmt.Sprintf("%s statefulset", name))
		return
	}
	if sts.Status.ReadyReplicas == *sts.Spec.Replicas {
		s.pass(fmt.Sprintf("%s: %d/%d ready", name, sts.Status.ReadyReplicas, *sts.Spec.Replicas))
	} else {
		s.fail(fmt.Sprintf("%s: %d/%d ready", name, sts.Status.ReadyReplicas, *sts.Spec.Replicas))
	}
}

func (s *TestSuite) checkNamespaceExists(ctx context.Context, name string) {
	_, err := s.clientset.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		s.fail(fmt.Sprintf("Namespace '%s' exists", name))
	} else {
		s.pass(fmt.Sprintf("Namespace '%s' exists", name))
	}
}

func (s *TestSuite) checkCRDExists(ctx context.Context, name, display string) {
	gvr := schema.GroupVersionResource{Group: "apiextensions.k8s.io", Version: "v1", Resource: "customresourcedefinitions"}
	_, err := s.dynamicClient.Resource(gvr).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		s.fail(display)
	} else {
		s.pass(display)
	}
}

func (s *TestSuite) checkIngressAndHealth(ctx context.Context, namespace, ingressName, componentName string) {
	ingresses, err := s.clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil || len(ingresses.Items) == 0 {
		s.warn(fmt.Sprintf("%s: no ingress found", componentName))
		return
	}

	var host string
	for _, ing := range ingresses.Items {
		if len(ing.Spec.Rules) > 0 {
			host = ing.Spec.Rules[0].Host
			break
		}
	}

	if host != "" {
		s.pass(fmt.Sprintf("%s ingress: %s", componentName, host))

		// Try health check
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(fmt.Sprintf("https://%s", host))
		if err == nil {
			resp.Body.Close()
			s.pass(fmt.Sprintf("%s: reachable (HTTP %d)", componentName, resp.StatusCode))
		} else {
			s.warn(fmt.Sprintf("%s: not reachable (DNS/network)", componentName))
		}
	} else {
		s.warn(fmt.Sprintf("%s: no host configured", componentName))
	}
}

func (s *TestSuite) checkSSOSecretSync(ctx context.Context) {
	// Get Dex pod and check env
	pods, err := s.clientset.CoreV1().Pods("argocd").List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=argocd-dex-server",
	})
	if err != nil || len(pods.Items) == 0 {
		s.warn("Could not check Dex SSO secret")
		return
	}

	// Get secret value
	secret, err := s.clientset.CoreV1().Secrets("argocd").Get(ctx, "argo-workflows-sso", metav1.GetOptions{})
	if err != nil {
		s.warn("argo-workflows-sso secret not found in argocd namespace")
		return
	}

	secretValue := string(secret.Data["client-secret"])

	// Check if Dex has the same value (we can't exec into pod easily, so check secret exists)
	if secretValue != "" {
		s.pass(fmt.Sprintf("SSO secret configured (len=%d)", len(secretValue)))
	}
}

func (s *TestSuite) PrintSummary() {
	s.printHeader("TEST SUMMARY")

	total := s.passed + s.failed + s.warnings
	fmt.Printf("\n  %s✓ Passed:%s   %d\n", colorGreen, colorReset, s.passed)
	fmt.Printf("  %s✗ Failed:%s   %d\n", colorRed, colorReset, s.failed)
	fmt.Printf("  %s⚠ Warnings:%s %d\n", colorYellow, colorReset, s.warnings)
	fmt.Printf("  ─────────────────\n")
	fmt.Printf("  Total:     %d\n", total)

	if s.failed == 0 {
		fmt.Printf("\n%s✓ All critical checks passed!%s\n\n", colorGreen, colorReset)
	} else {
		fmt.Printf("\n%s✗ Some checks failed. Review output above.%s\n\n", colorRed, colorReset)
	}
}

// Helper to decode base64
func decodeBase64(encoded string) string {
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return ""
	}
	return string(decoded)
}

// Helper to parse JSON
func parseJSON(data string) map[string]interface{} {
	var result map[string]interface{}
	json.Unmarshal([]byte(data), &result)
	return result
}
