
import React from "react";

const Privacy = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Política de Privacidad - +Léxico</h1>
      <p className="text-sm text-gray-600"><strong>Última actualización:</strong> 24 de junio de 2025</p>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">1. Información General</h2>
          <p className="text-gray-600">+Léxico es una aplicación de búsqueda de palabras para juegos de palabras en español. Esta política describe cómo manejamos la información en nuestra aplicación móvil para iOS.</p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">2. Información que NO Recopilamos</h2>
          <p className="text-gray-600 mb-3">+Léxico está diseñada para proteger tu privacidad:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li><strong>No recopilamos información personal</strong> (nombres, correos, teléfonos)</li>
            <li><strong>No requerimos registro</strong> ni creación de cuentas</li>
            <li><strong>No accedemos a contactos</strong> ni fotos</li>
            <li><strong>No utilizamos ubicación</strong> geográfica</li>
            <li><strong>No enviamos datos</strong> a servidores externos</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">3. Funcionamiento Offline</h2>
          <p className="text-gray-600 mb-3">+Léxico funciona completamente offline:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>Todas las búsquedas se procesan localmente en tu dispositivo</li>
            <li>La base de datos de palabras está almacenada en tu dispositivo</li>
            <li>No se requiere conexión a internet para usar la app</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">4. Datos Almacenados Localmente</h2>
          <p className="text-gray-600 mb-3">La aplicación almacena únicamente en tu dispositivo:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>Base de datos de palabras en español para Scrabble</li>
            <li>Preferencias de personalización (colores de interfaz)</li>
            <li>Configuraciones de la aplicación</li>
          </ul>
          <p className="text-gray-600 mt-3">Estos datos nunca salen de tu dispositivo.</p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">5. Analíticas y Publicidad</h2>
          <p className="text-gray-600 mb-3">+Léxico NO utiliza:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>Servicios de analíticas (Google Analytics, etc.)</li>
            <li>Redes publicitarias</li>
            <li>Servicios de tracking</li>
            <li>Cookies o identificadores únicos</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">6. Compartir Información</h2>
          <p className="text-gray-600">Como no recopilamos información personal, no hay datos que compartir con terceros.</p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">7. Seguridad</h2>
          <p className="text-gray-600">Al no transmitir ni almacenar información personal en servidores, +Léxico elimina riesgos de filtración de datos personales.</p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">8. Derechos del Usuario</h2>
          <p className="text-gray-600 mb-3">Puedes:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>Usar la app sin proporcionar información personal</li>
            <li>Eliminar la app y todos sus datos borrando la aplicación</li>
            <li>Restablecer configuraciones desde la app</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">9. Cambios a Esta Política</h2>
          <p className="text-gray-600">Las actualizaciones a esta política se publicarán en esta página. El uso continuado de la aplicación constituye aceptación de los cambios.</p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">10. Contacto</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-600 mb-2">Para preguntas sobre esta política de privacidad:</p>
            <p className="text-gray-600"><strong>Email:</strong> privacy@maslexico.app</p>
            <p className="text-gray-600"><strong>Sitio web:</strong> https://maslexico.app</p>
          </div>
        </div>

        <div className="border-t pt-6">
          <p className="text-gray-500 italic">Esta política refleja nuestro compromiso con la privacidad: +Léxico es una herramienta de palabras que respeta completamente tu privacidad al no recopilar ningún dato personal.</p>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
