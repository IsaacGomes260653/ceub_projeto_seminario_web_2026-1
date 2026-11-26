import { DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { PrismaService } from "./banco/prisma.service.js";
import { FiltroDeErros } from "./comum/filtro-de-erros.js";
import { GuardaDaChaveDeApi, GuardaDeAutenticacao, GuardaDePermissao } from "./comum/guardas.js";
import { CONFIG, type Config } from "./config.js";
import { FuncionalidadesController, FuncionalidadesService } from "./funcionalidades/funcionalidades.js";
import { ConsignacaoController, ConsignacaoService } from "./loja/consignacao.js";
import { PainelController, PainelService } from "./loja/painel.js";
import { PedidosController, PedidosService } from "./loja/pedidos.js";
import { EmDia, ReservasService } from "./loja/reservas.js";
import { SacolaController, SacolaService } from "./loja/sacola.js";
import { PecasController, PecasService } from "./pecas/pecas.js";
import { PerfisController, PerfisService } from "./perfis/perfis.js";
import { SaudeController } from "./saude.controller.js";
import { UsuariosController, UsuariosService } from "./usuarios/usuarios.js";

// Módulo raiz. A configuração entra de fora para os testes poderem trocar banco, relógio e limites.
@Module({})
export class AppModule {
  static com(config: Config): DynamicModule {
    return {
      module: AppModule,
      controllers: [SaudeController, AuthController, UsuariosController, PerfisController, FuncionalidadesController, PecasController, SacolaController, PedidosController, ConsignacaoController, PainelController],
      providers: [
        { provide: CONFIG, useValue: config },
        PrismaService, AuthService, UsuariosService, PerfisService, FuncionalidadesService, PecasService,
        ReservasService, EmDia, SacolaService, PedidosService, ConsignacaoService, PainelService,
        GuardaDeAutenticacao, GuardaDePermissao,
        // A chave de API vale para todas as rotas, e o filtro de erros para todas as respostas.
        { provide: APP_GUARD, useClass: GuardaDaChaveDeApi },
        { provide: APP_FILTER, useClass: FiltroDeErros },
      ],
    };
  }
}
