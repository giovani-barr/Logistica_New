from django.test import TestCase, Client
from django.contrib.auth.models import User
from rotas.models import Rota, Parada, ConfiguracaoUsuario
from rest_framework.test import APIClient, APITestCase
from rest_framework import status


class RotaModelTests(TestCase):
    """Testes para o modelo Rota"""
    
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass123')
    
    def test_criar_rota(self):
        """Teste criação de rota"""
        rota = Rota.objects.create(
            usuario=self.user,
            nome='Rota Teste',
            descricao='Descrição teste'
        )
        self.assertEqual(rota.nome, 'Rota Teste')
        self.assertEqual(rota.usuario, self.user)
        self.assertEqual(rota.status, 'planejamento')
    
    def test_rota_string_representation(self):
        """Teste representação em string da rota"""
        rota = Rota.objects.create(
            usuario=self.user,
            nome='Rota Test'
        )
        self.assertEqual(str(rota), 'Rota Test - Planejamento')


class ParadaModelTests(TestCase):
    """Testes para o modelo Parada"""
    
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.rota = Rota.objects.create(usuario=self.user, nome='Rota Teste')
    
    def test_criar_parada(self):
        """Teste criação de parada"""
        parada = Parada.objects.create(
            rota=self.rota,
            sequencia=1,
            cliente_nome='Cliente Teste',
            endereco='Rua Teste, 123',
            latitude=-0.034987,
            longitude=-51.074846
        )
        self.assertEqual(parada.cliente_nome, 'Cliente Teste')
        self.assertEqual(parada.rota, self.rota)
    
    def test_parada_ordernacao(self):
        """Teste ordenação de paradas"""
        p1 = Parada.objects.create(
            rota=self.rota, sequencia=1,
            cliente_nome='Cliente 1',
            latitude=0, longitude=0
        )
        p2 = Parada.objects.create(
            rota=self.rota, sequencia=2,
            cliente_nome='Cliente 2',
            latitude=0, longitude=0
        )
        paradas = Parada.objects.filter(rota=self.rota).order_by('sequencia')
        self.assertEqual(paradas[0].cliente_nome, 'Cliente 1')
        self.assertEqual(paradas[1].cliente_nome, 'Cliente 2')


class ConfiguracaoUsuarioTests(TestCase):
    """Testes para ConfiguracaoUsuario"""
    
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass123')
    
    def test_configuracao_criar_automaticamente(self):
        """Testa se configuração é criada automaticamente"""
        # Já deve existir devido ao signal
        config = ConfiguracaoUsuario.objects.get(usuario=self.user)
        self.assertEqual(config.usuario, self.user)
        self.assertEqual(config.nome_empresa, 'FERMAP Logística')


class RotaViewTests(TestCase):
    """Testes para as views de Rota"""
    
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.rota = Rota.objects.create(usuario=self.user, nome='Rota Teste')
    
    def test_index_view_nao_autenticado(self):
        """Teste acesso ao index sem autenticação"""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)  # Redireciona para login
    
    def test_lista_rotas_autenticado(self):
        """Teste visualização de lista de rotas"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get('/rotas/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Rota Teste')
    
    def test_criar_rota_get(self):
        """Teste GET para criar rota"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get('/rotas/criar/')
        self.assertEqual(response.status_code, 200)
    
    def test_criar_rota_post(self):
        """Teste POST para criar rota"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.post('/rotas/criar/', {
            'nome': 'Nova Rota',
            'descricao': 'Descrição'
        })
        self.assertEqual(response.status_code, 302)  # Redireciona após sucesso
        self.assertTrue(Rota.objects.filter(nome='Nova Rota').exists())


class APIRotaTests(APITestCase):
    """Testes para API REST de Rotas"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='apiuser', password='apipass123')
        self.rota = Rota.objects.create(usuario=self.user, nome='API Rota Teste')
    
    def test_lista_rotas_nao_autenticado(self):
        """Teste GET /api/rotas/ sem autenticação"""
        response = self.client.get('/api/rotas/')
        self.assertNotEqual(response.status_code, 200)
    
    def test_lista_rotas_autenticado(self):
        """Teste GET /api/rotas/ com autenticação"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/rotas/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)
    
    def test_criar_rota_api(self):
        """Teste POST /api/rotas/"""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/rotas/', {
            'nome': 'Nova API Rota',
            'descricao': 'Teste'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nome'], 'Nova API Rota')
    
    def test_detalhe_rota_api(self):
        """Teste GET /api/rotas/{id}/"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/rotas/{self.rota.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['nome'], 'API Rota Teste')


class PermissaoTests(TestCase):
    """Testes de permissões"""
    
    def setUp(self):
        self.user1 = User.objects.create_user(username='user1', password='pass123')
        self.user2 = User.objects.create_user(username='user2', password='pass123')
        self.rota = Rota.objects.create(usuario=self.user1, nome='Rota User1')
    
    def test_user_nao_pode_ver_rota_outro_user(self):
        """Teste se user2 não pode ver rota de user1"""
        self.client.login(username='user2', password='pass123')
        response = self.client.get(f'/rotas/{self.rota.id}/')
        self.assertEqual(response.status_code, 404)
