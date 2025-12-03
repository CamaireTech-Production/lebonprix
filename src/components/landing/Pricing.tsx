import React from 'react'
import { Link } from 'react-router-dom'
import { SectionContainer } from './SectionContainer'

const Pricing = () => {
  return (

   <SectionContainer backgroundColor='beige'>   
        <div className='bg-beige flex gap-12 justify-center items-center w-full p-12'>
            <div>
                <img src="/placeholder.png" className='py-12 object-cover' alt="Pricing" />
            </div>
            <div>
                <h2 className='text-4xl sm:text-3xl font-title font-bold text-black mb-6'>economisez jusqu'a 30% sur vos factures</h2>
                <p>Geskap est conçu pour optimiser vos coûts en minimisant les frais de transaction et en offrant des solutions flexibles et adaptées à vos besoins.</p>
                <button className='bg-black text-white px-8 py-4 rounded-3xl font-semibold hover:bg-gray-900 transition-all duration-300 hover:scale-105'>Découvrir les tarifs</button>
                <p>
                    Vous avez déjà un compte ?{' '}
                    <Link to="/auth/login" className="text-emerald-600 hover:text-emerald-700 font-medium underline">
                        Connectez-vous pour configurer votre compte
                    </Link>
                </p>
            </div>

        </div>
   </SectionContainer>
  )
}

export default Pricing