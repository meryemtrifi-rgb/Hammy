const PRODUCTS = [
  { id: 1, name: 'Bague Dôme', category: 'Bagues', priceCents: 5900, description: 'Un grand dôme ovale au poli miroir. Elle se porte seule.', optionLabel: 'Taille', options: ['52', '54', '56', '58', '60'], stock: { '52': 5, '54': 5, '56': 5, '58': 5, '60': 5 }, images: ['d'] },
  { id: 2, name: 'Bague Goutte', category: 'Bagues', priceCents: 5400, description: "Deux gouttes d'acier qui s'ouvrent sur le doigt. Taille ajustable.", optionLabel: 'Taille', options: ['Ajustable'], stock: { Ajustable: 10 }, images: ['o'] },
  { id: 3, name: 'Bague Ondine', category: 'Bagues', priceCents: 6400, description: 'Une ligne sinueuse qui suit le doigt, sertie de trois zircons améthyste.', optionLabel: 'Taille', options: ['Ajustable'], stock: { Ajustable: 8 }, images: ['a1', 'a2'] },
  { id: 4, name: 'Bague Gemme', category: 'Bagues', priceCents: 5900, description: "Chevalière sertie d'une pierre, bords ciselés. Trois styles au choix.", optionLabel: 'Style', options: ['Cœur clair', 'Émeraude carrée', 'Émeraude ovale'], stock: { 'Cœur clair': 5, 'Émeraude carrée': 5, 'Émeraude ovale': 5 }, images: ['g'] },
  { id: 5, name: 'Collier Cœur Visage', category: 'Colliers', priceCents: 7900, description: 'Grand pendentif cœur gravé d’un visage et de fleurs, sur chaîne maille vénitienne.', optionLabel: 'Longueur', options: ['45 cm', '50 cm', '55 cm'], stock: { '45 cm': 4, '50 cm': 4, '55 cm': 4 }, images: ['h'] },
  { id: 6, name: 'Collier Soleil', category: 'Colliers', priceCents: 7400, description: 'Un soleil à visage et rayons ciselés, sur chaîne forçat fine.', optionLabel: 'Longueur', options: ['45 cm', '50 cm'], stock: { '45 cm': 5, '50 cm': 5 }, images: ['s'] },
  { id: 7, name: 'Collier Maille Tressée', category: 'Colliers', priceCents: 8900, description: 'Large maille tressée qui épouse le cou, avec ou sans fermoir en T.', optionLabel: 'Longueur', options: ['40 cm', '45 cm'], stock: { '40 cm': 3, '45 cm': 3 }, images: ['c1', 'c2'] }
];

function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.priceCents / 100,
    priceCents: product.priceCents,
    description: product.description,
    optionLabel: product.optionLabel,
    options: product.options,
    stock: product.stock,
    images: product.images,
    active: product.active !== false
  };
}

module.exports = { PRODUCTS, publicProduct };
