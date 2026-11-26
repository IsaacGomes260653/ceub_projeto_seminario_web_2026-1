// Cada item do menu aponta a funcionalidade que o perfil precisa ter para vê-lo.
export const MENU = [
  { rota: "/catalogo", rotulo: "Catálogo", exige: "catalogo.ver" },
  { rota: "/pecas", rotulo: "Peças", exige: "pecas.gerenciar" },
  { rota: "/usuarios", rotulo: "Usuários", exige: "usuarios.gerenciar" },
  { rota: "/perfis", rotulo: "Perfis", exige: "perfis.gerenciar" },
  { rota: "/funcionalidades", rotulo: "Funcionalidades", exige: "funcionalidades.gerenciar" },
];
export const CATEGORIAS = ["Camisetas e blusas", "Camisas", "Vestidos", "Saias", "Calças jeans", "Jaquetas e casacos", "Calçados", "Bolsas e acessórios"];
export const CONSERVACOES = ["Novo com etiqueta", "Ótimo estado", "Bom estado", "Com marcas de uso"];
export const SITUACOES = ["Disponível", "Reservada", "Vendida"];
export const FOTOS = ["camiseta-listrada", "camiseta-verde", "camiseta-bolso", "camiseta-preta", "camiseta-flor", "camiseta-vinho", "camisa-linho", "camisa-estampada", "moletom-clube", "trico-caramelo", "jaqueta-jeans", "jaqueta-caqui", "calca-jeans", "calca-escura", "saia-verde", "vestido-floral", "vestido-linho", "tenis-lona", "bolsa-couro"];
export const brl = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
