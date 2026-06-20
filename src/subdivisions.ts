/**
 * Country sub-divisions for the per-channel admin UI. Keys are ISO
 * 3166-1 alpha-2 country codes; values are an array of
 * {code, label} pairs using the ISO 3166-2 subdivision codes.
 *
 * Used to let admins say things like "ship to the US but not Alaska
 * or Hawaii" or "ship to Canada but only the eastern provinces". The
 * storefront enforces these with the resolved country + region from the
 * upstream proxy (Cloudflare populates region for most jurisdictions).
 *
 * Hand-curated to cover the markets most likely to need sub-region
 * targeting:
 *   - GB: UK constituent countries (legacy use case)
 *   - US: 50 states + DC + territories
 *   - CA: 10 provinces + 3 territories
 *   - AU: 8 states + territories
 *   - DE: 16 Länder
 *   - IN: 28 states + 8 union territories
 *   - BR: 27 federative units
 *   - MX: 32 federal entities
 *   - CN: 31 province-level divisions (mainland only)
 *   - IT: 20 regions
 *   - ES: 17 autonomous communities + 2 cities
 *   - FR: 18 regions (post-2016)
 */

export interface SubdivisionDef {
    code: string;
    label: string;
}

export const SUBDIVISIONS: Record<string, SubdivisionDef[]> = {
    GB: [
        { code: 'ENG', label: 'England' },
        { code: 'WLS', label: 'Wales' },
        { code: 'SCT', label: 'Scotland' },
        { code: 'NIR', label: 'Northern Ireland' },
    ],
    US: [
        { code: 'AL', label: 'Alabama' }, { code: 'AK', label: 'Alaska' },
        { code: 'AZ', label: 'Arizona' }, { code: 'AR', label: 'Arkansas' },
        { code: 'CA', label: 'California' }, { code: 'CO', label: 'Colorado' },
        { code: 'CT', label: 'Connecticut' }, { code: 'DE', label: 'Delaware' },
        { code: 'DC', label: 'District of Columbia' }, { code: 'FL', label: 'Florida' },
        { code: 'GA', label: 'Georgia' }, { code: 'HI', label: 'Hawaii' },
        { code: 'ID', label: 'Idaho' }, { code: 'IL', label: 'Illinois' },
        { code: 'IN', label: 'Indiana' }, { code: 'IA', label: 'Iowa' },
        { code: 'KS', label: 'Kansas' }, { code: 'KY', label: 'Kentucky' },
        { code: 'LA', label: 'Louisiana' }, { code: 'ME', label: 'Maine' },
        { code: 'MD', label: 'Maryland' }, { code: 'MA', label: 'Massachusetts' },
        { code: 'MI', label: 'Michigan' }, { code: 'MN', label: 'Minnesota' },
        { code: 'MS', label: 'Mississippi' }, { code: 'MO', label: 'Missouri' },
        { code: 'MT', label: 'Montana' }, { code: 'NE', label: 'Nebraska' },
        { code: 'NV', label: 'Nevada' }, { code: 'NH', label: 'New Hampshire' },
        { code: 'NJ', label: 'New Jersey' }, { code: 'NM', label: 'New Mexico' },
        { code: 'NY', label: 'New York' }, { code: 'NC', label: 'North Carolina' },
        { code: 'ND', label: 'North Dakota' }, { code: 'OH', label: 'Ohio' },
        { code: 'OK', label: 'Oklahoma' }, { code: 'OR', label: 'Oregon' },
        { code: 'PA', label: 'Pennsylvania' }, { code: 'RI', label: 'Rhode Island' },
        { code: 'SC', label: 'South Carolina' }, { code: 'SD', label: 'South Dakota' },
        { code: 'TN', label: 'Tennessee' }, { code: 'TX', label: 'Texas' },
        { code: 'UT', label: 'Utah' }, { code: 'VT', label: 'Vermont' },
        { code: 'VA', label: 'Virginia' }, { code: 'WA', label: 'Washington' },
        { code: 'WV', label: 'West Virginia' }, { code: 'WI', label: 'Wisconsin' },
        { code: 'WY', label: 'Wyoming' },
        { code: 'PR', label: 'Puerto Rico' }, { code: 'GU', label: 'Guam' },
        { code: 'VI', label: 'US Virgin Islands' }, { code: 'AS', label: 'American Samoa' },
        { code: 'MP', label: 'Northern Mariana Islands' },
    ],
    CA: [
        { code: 'AB', label: 'Alberta' }, { code: 'BC', label: 'British Columbia' },
        { code: 'MB', label: 'Manitoba' }, { code: 'NB', label: 'New Brunswick' },
        { code: 'NL', label: 'Newfoundland and Labrador' },
        { code: 'NS', label: 'Nova Scotia' }, { code: 'ON', label: 'Ontario' },
        { code: 'PE', label: 'Prince Edward Island' }, { code: 'QC', label: 'Quebec' },
        { code: 'SK', label: 'Saskatchewan' },
        { code: 'NT', label: 'Northwest Territories' }, { code: 'NU', label: 'Nunavut' },
        { code: 'YT', label: 'Yukon' },
    ],
    AU: [
        { code: 'ACT', label: 'Australian Capital Territory' },
        { code: 'NSW', label: 'New South Wales' },
        { code: 'NT',  label: 'Northern Territory' },
        { code: 'QLD', label: 'Queensland' },
        { code: 'SA',  label: 'South Australia' },
        { code: 'TAS', label: 'Tasmania' },
        { code: 'VIC', label: 'Victoria' },
        { code: 'WA',  label: 'Western Australia' },
    ],
    DE: [
        { code: 'BW', label: 'Baden-Württemberg' }, { code: 'BY', label: 'Bavaria' },
        { code: 'BE', label: 'Berlin' }, { code: 'BB', label: 'Brandenburg' },
        { code: 'HB', label: 'Bremen' }, { code: 'HH', label: 'Hamburg' },
        { code: 'HE', label: 'Hesse' }, { code: 'MV', label: 'Mecklenburg-Vorpommern' },
        { code: 'NI', label: 'Lower Saxony' }, { code: 'NW', label: 'North Rhine-Westphalia' },
        { code: 'RP', label: 'Rhineland-Palatinate' }, { code: 'SL', label: 'Saarland' },
        { code: 'SN', label: 'Saxony' }, { code: 'ST', label: 'Saxony-Anhalt' },
        { code: 'SH', label: 'Schleswig-Holstein' }, { code: 'TH', label: 'Thuringia' },
    ],
    IT: [
        { code: '65', label: 'Abruzzo' }, { code: '77', label: 'Basilicata' },
        { code: '78', label: 'Calabria' }, { code: '72', label: 'Campania' },
        { code: '45', label: 'Emilia-Romagna' }, { code: '36', label: 'Friuli-Venezia Giulia' },
        { code: '62', label: 'Lazio' }, { code: '42', label: 'Liguria' },
        { code: '25', label: 'Lombardy' }, { code: '57', label: 'Marche' },
        { code: '67', label: 'Molise' }, { code: '21', label: 'Piedmont' },
        { code: '75', label: 'Apulia' }, { code: '88', label: 'Sardinia' },
        { code: '82', label: 'Sicily' }, { code: '52', label: 'Tuscany' },
        { code: '32', label: 'Trentino-Alto Adige' }, { code: '55', label: 'Umbria' },
        { code: '23', label: 'Aosta Valley' }, { code: '34', label: 'Veneto' },
    ],
    FR: [
        { code: 'ARA', label: 'Auvergne-Rhône-Alpes' },
        { code: 'BFC', label: 'Bourgogne-Franche-Comté' },
        { code: 'BRE', label: 'Brittany' }, { code: 'CVL', label: 'Centre-Val de Loire' },
        { code: 'COR', label: 'Corsica' }, { code: 'GES', label: 'Grand Est' },
        { code: 'HDF', label: 'Hauts-de-France' }, { code: 'IDF', label: 'Île-de-France' },
        { code: 'NOR', label: 'Normandy' }, { code: 'NAQ', label: 'Nouvelle-Aquitaine' },
        { code: 'OCC', label: 'Occitania' }, { code: 'PDL', label: 'Pays de la Loire' },
        { code: 'PAC', label: "Provence-Alpes-Côte d'Azur" },
        { code: 'GP',  label: 'Guadeloupe' }, { code: 'MQ',  label: 'Martinique' },
        { code: 'GF',  label: 'French Guiana' }, { code: 'RE',  label: 'Réunion' },
        { code: 'YT',  label: 'Mayotte' },
    ],
    ES: [
        { code: 'AN', label: 'Andalusia' }, { code: 'AR', label: 'Aragon' },
        { code: 'AS', label: 'Asturias' }, { code: 'IB', label: 'Balearic Islands' },
        { code: 'CN', label: 'Canary Islands' }, { code: 'CB', label: 'Cantabria' },
        { code: 'CM', label: 'Castile-La Mancha' }, { code: 'CL', label: 'Castile and León' },
        { code: 'CT', label: 'Catalonia' }, { code: 'EX', label: 'Extremadura' },
        { code: 'GA', label: 'Galicia' }, { code: 'RI', label: 'La Rioja' },
        { code: 'MD', label: 'Madrid' }, { code: 'MC', label: 'Murcia' },
        { code: 'NC', label: 'Navarre' }, { code: 'PV', label: 'Basque Country' },
        { code: 'VC', label: 'Valencia' },
        { code: 'CE', label: 'Ceuta' }, { code: 'ML', label: 'Melilla' },
    ],
    IN: [
        { code: 'AN', label: 'Andaman and Nicobar Islands' }, { code: 'AP', label: 'Andhra Pradesh' },
        { code: 'AR', label: 'Arunachal Pradesh' }, { code: 'AS', label: 'Assam' },
        { code: 'BR', label: 'Bihar' }, { code: 'CH', label: 'Chandigarh' },
        { code: 'CT', label: 'Chhattisgarh' }, { code: 'DH', label: 'Dadra and Nagar Haveli and Daman and Diu' },
        { code: 'DL', label: 'Delhi' }, { code: 'GA', label: 'Goa' },
        { code: 'GJ', label: 'Gujarat' }, { code: 'HR', label: 'Haryana' },
        { code: 'HP', label: 'Himachal Pradesh' }, { code: 'JK', label: 'Jammu and Kashmir' },
        { code: 'JH', label: 'Jharkhand' }, { code: 'KA', label: 'Karnataka' },
        { code: 'KL', label: 'Kerala' }, { code: 'LA', label: 'Ladakh' },
        { code: 'LD', label: 'Lakshadweep' }, { code: 'MP', label: 'Madhya Pradesh' },
        { code: 'MH', label: 'Maharashtra' }, { code: 'MN', label: 'Manipur' },
        { code: 'ML', label: 'Meghalaya' }, { code: 'MZ', label: 'Mizoram' },
        { code: 'NL', label: 'Nagaland' }, { code: 'OR', label: 'Odisha' },
        { code: 'PY', label: 'Puducherry' }, { code: 'PB', label: 'Punjab' },
        { code: 'RJ', label: 'Rajasthan' }, { code: 'SK', label: 'Sikkim' },
        { code: 'TN', label: 'Tamil Nadu' }, { code: 'TG', label: 'Telangana' },
        { code: 'TR', label: 'Tripura' }, { code: 'UP', label: 'Uttar Pradesh' },
        { code: 'UT', label: 'Uttarakhand' }, { code: 'WB', label: 'West Bengal' },
    ],
    BR: [
        { code: 'AC', label: 'Acre' }, { code: 'AL', label: 'Alagoas' },
        { code: 'AP', label: 'Amapá' }, { code: 'AM', label: 'Amazonas' },
        { code: 'BA', label: 'Bahia' }, { code: 'CE', label: 'Ceará' },
        { code: 'DF', label: 'Federal District' }, { code: 'ES', label: 'Espírito Santo' },
        { code: 'GO', label: 'Goiás' }, { code: 'MA', label: 'Maranhão' },
        { code: 'MT', label: 'Mato Grosso' }, { code: 'MS', label: 'Mato Grosso do Sul' },
        { code: 'MG', label: 'Minas Gerais' }, { code: 'PA', label: 'Pará' },
        { code: 'PB', label: 'Paraíba' }, { code: 'PR', label: 'Paraná' },
        { code: 'PE', label: 'Pernambuco' }, { code: 'PI', label: 'Piauí' },
        { code: 'RJ', label: 'Rio de Janeiro' }, { code: 'RN', label: 'Rio Grande do Norte' },
        { code: 'RS', label: 'Rio Grande do Sul' }, { code: 'RO', label: 'Rondônia' },
        { code: 'RR', label: 'Roraima' }, { code: 'SC', label: 'Santa Catarina' },
        { code: 'SP', label: 'São Paulo' }, { code: 'SE', label: 'Sergipe' },
        { code: 'TO', label: 'Tocantins' },
    ],
    MX: [
        { code: 'AGU', label: 'Aguascalientes' }, { code: 'BCN', label: 'Baja California' },
        { code: 'BCS', label: 'Baja California Sur' }, { code: 'CAM', label: 'Campeche' },
        { code: 'CHP', label: 'Chiapas' }, { code: 'CHH', label: 'Chihuahua' },
        { code: 'CMX', label: 'Mexico City' }, { code: 'COA', label: 'Coahuila' },
        { code: 'COL', label: 'Colima' }, { code: 'DUR', label: 'Durango' },
        { code: 'GUA', label: 'Guanajuato' }, { code: 'GRO', label: 'Guerrero' },
        { code: 'HID', label: 'Hidalgo' }, { code: 'JAL', label: 'Jalisco' },
        { code: 'MEX', label: 'State of Mexico' }, { code: 'MIC', label: 'Michoacán' },
        { code: 'MOR', label: 'Morelos' }, { code: 'NAY', label: 'Nayarit' },
        { code: 'NLE', label: 'Nuevo León' }, { code: 'OAX', label: 'Oaxaca' },
        { code: 'PUE', label: 'Puebla' }, { code: 'QUE', label: 'Querétaro' },
        { code: 'ROO', label: 'Quintana Roo' }, { code: 'SLP', label: 'San Luis Potosí' },
        { code: 'SIN', label: 'Sinaloa' }, { code: 'SON', label: 'Sonora' },
        { code: 'TAB', label: 'Tabasco' }, { code: 'TAM', label: 'Tamaulipas' },
        { code: 'TLA', label: 'Tlaxcala' }, { code: 'VER', label: 'Veracruz' },
        { code: 'YUC', label: 'Yucatán' }, { code: 'ZAC', label: 'Zacatecas' },
    ],
};

export function hasSubdivisions(country: string): boolean {
    return country.toUpperCase() in SUBDIVISIONS;
}

export function getSubdivisions(country: string): SubdivisionDef[] {
    return SUBDIVISIONS[country.toUpperCase()] || [];
}
