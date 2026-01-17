import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Save, Printer, CheckCircle, AlertCircle, Loader2, DollarSign, Clock, TestTube2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useServiceData, getVisibleItems } from '../hooks/useServiceData';
import { getRegionsList, getCitiesByRegion, getDistrictsByCity } from '../data/saudiRegions';
import ConditionalDocuments from './ConditionalDocuments';
import ProgressSteps from './ProgressSteps';
import SidebarSummary from './SidebarSummary';
import { findMatchingPricingRule } from '../utils/conditionEvaluator';
import TextField from './fields/TextField';
import SelectField from './fields/SelectField';
import SearchableSelectField from './fields/SearchableSelectField';
import RadioGroupField from './fields/RadioGroupField';
import CheckboxField from './fields/CheckboxField';
import TextareaField from './fields/TextareaField';
import DateField from './fields/DateField';
import NumberField from './fields/NumberField';
import FileField from './fields/FileField';
import DynamicListField from './fields/DynamicListField';
import InfoField from './fields/InfoField';

const fieldComponents = {
  text: TextField,
  select: SelectField,
  'searchable-select': SearchableSelectField,
  radio: RadioGroupField,
  checkbox: CheckboxField,
  textarea: TextareaField,
  date: DateField,
  number: NumberField,
  tel: TextField,
  email: TextField,
  file: FileField,
  'dynamic-list': DynamicListField,
  info: InfoField,
  label: InfoField,
};

export default function DynamicServiceForm({ serviceSlug, serviceTypeId, onSubmit }) {
  const navigate = useNavigate();
  const { service, requirements, documents, fields, pricingRules, loading, error } = useServiceData(serviceSlug, serviceTypeId);

  // 🔍 LOG: Check what we received from the hook
  useEffect(() => {
    console.log('🔵🔵🔵 [DynamicServiceForm] Data received from useServiceData:', {
      serviceSlug,
      serviceTypeId,
      hasService: !!service,
      serviceName: service?.name_ar,
      requirementsCount: requirements?.length || 0,
      documentsCount: documents?.length || 0,
      documentsArray: documents,
      fieldsCount: fields?.length || 0,
      fieldsArray: fields,
      fieldsIsArray: Array.isArray(fields),
      firstField: fields?.[0],
      loading,
      error
    });
  }, [service, documents, fields, requirements, loading, error]);

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [availableCities, setAvailableCities] = useState([]);
  const [availableDistricts, setAvailableDistricts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState({
    dataAccuracy: false,
    termsAndConditions: false,
    communicationConsent: false
  });

  const steps = [
    { id: 'personal', title: 'بيانات المتقدم', completed: false },
    { id: 'details', title: 'تفاصيل الخدمة', completed: false },
    { id: 'review', title: 'المراجعة والدفع', completed: false }
  ];

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));

    if (fieldName === 'region') {
      const cities = getCitiesByRegion(value);
      setAvailableCities(cities);
      setFormData(prev => ({ ...prev, city: '', district: '' }));
      setAvailableDistricts([]);
    }
    if (fieldName === 'city') {
      setFormData(prev => {
        const districts = getDistrictsByCity(prev.region, value);
        setAvailableDistricts(districts);
        return { ...prev, district: '' };
      });
    }

    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: null }));
    }
  };

  // تعبئة البيانات التجريبية
  const fillTestData = () => {
    const randomPhone = `05${Math.floor(Math.random() * 90000000) + 10000000}`;
    const randomId = `P${Math.floor(Math.random() * 9000000) + 1000000}`;

    const testData = {
      // البيانات الشخصية
      fullName: 'أحمد محمد السعيد الخليفة',
      nationalId: randomId,
      phoneNumber: randomPhone,
      email: 'ahmed.test@example.com',
      dob: '1990-05-15',
      gender: 'male',
      isAdult: 'yes',
      nationality: 'سوداني',
      region: 'منطقة الرياض',
      city: 'الرياض',
      district: 'العليا',
      address: 'شارع الملك فهد، حي العليا، الرياض 12345',
      profession: 'مهندس برمجيات',
      workplace: 'شركة التقنية المتقدمة',

      // بيانات إضافية شائعة
      maritalStatus: 'married',
      passportNumber: 'A12345678',
      educationLevel: 'university',
      motherName: 'فاطمة أحمد',
      fatherName: 'محمد السعيد',
      grandFatherName: 'السعيد الخليفة',

      // بيانات للتوكيلات
      agentName: 'عبدالله محمد أحمد',
      agentNationalId: 'A98765432',
      agentRelationship: 'أخ',
      purposeOfPOA: 'إنهاء معاملات حكومية',

      // بيانات للسجل المدني
      birthPlace: 'الخرطوم',
      birthDate: '1990-05-15',

      // بيانات للجوازات
      passportType: 'ordinary',
      travelPurpose: 'work',
      currentPassportNumber: 'A98765432',
      passportIssueDate: '2020-01-15',
      passportExpiryDate: '2030-01-15',

      // بيانات مالية
      paymentMethod: 'card',

      // ملاحظات
      notes: 'هذه بيانات تجريبية للاختبار فقط'
    };

    // تعبئة الحقول الأساسية
    setFormData(testData);

    // تحديث المدن والأحياء
    const cities = getCitiesByRegion('منطقة الرياض');
    setAvailableCities(cities);
    const districts = getDistrictsByCity('منطقة الرياض', 'الرياض');
    setAvailableDistricts(districts);

    // تعبئة حقول الخدمة الديناميكية
    if (fields && fields.length > 0) {
      const serviceFieldsData = {};

      fields.forEach(field => {
        const fieldName = field.field_name;

        // تخطي الحقول المعبأة بالفعل
        if (testData[fieldName]) return;

        // تخطي الحقول المشروطة التي يعتمد عليها حقول أخرى
        const isControlField = field.field_name === 'poaSubtype' ||
                               field.field_name === 'passportType' ||
                               field.field_name === 'isAdult';

        switch (field.field_type) {
          case 'text':
          case 'textarea':
            serviceFieldsData[fieldName] = `قيمة تجريبية لـ ${field.label_ar}`;
            break;
          case 'email':
            serviceFieldsData[fieldName] = 'test@example.com';
            break;
          case 'tel':
            serviceFieldsData[fieldName] = '0501234567';
            break;
          case 'number':
            serviceFieldsData[fieldName] = '123';
            break;
          case 'date':
            serviceFieldsData[fieldName] = '2025-01-15';
            break;
          case 'checkbox':
            serviceFieldsData[fieldName] = true;
            break;
          case 'radio':
          case 'select':
          case 'searchable-select':
            // لا تملأ الحقول التي يعتمد عليها حقول أخرى تلقائياً
            if (!isControlField && field.options && field.options.length > 0) {
              serviceFieldsData[fieldName] = field.options[0].value;
            }
            break;
          default:
            break;
        }
      });

      setFormData(prev => ({ ...prev, ...serviceFieldsData }));
    }

    // رسالة نجاح
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg shadow-xl z-50 flex items-center gap-3 animate-bounce';
    notification.innerHTML = `
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <span class="font-bold">تم تعبئة البيانات التجريبية بنجاح!</span>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  const validatePersonalInfo = () => {
    const personalErrors = {};
    // الحقول الأساسية فقط مطلوبة
    const requiredFields = ['fullName', 'nationalId', 'phoneNumber'];

    console.log('🔍 [validatePersonalInfo] Checking required fields:', {
      required: requiredFields,
      currentValues: requiredFields.map(f => ({ field: f, value: formData[f], filled: !!formData[f] }))
    });

    requiredFields.forEach(field => {
      if (!formData[field]) {
        personalErrors[field] = 'هذا الحقل مطلوب';
      }
    });

    if (formData.phoneNumber && !/^(05|5)\d{8}$/.test(formData.phoneNumber)) {
      personalErrors.phoneNumber = 'رقم الجوال غير صحيح';
    }

    console.log('📋 [validatePersonalInfo] Validation result:', {
      hasErrors: Object.keys(personalErrors).length > 0,
      errors: personalErrors
    });

    setErrors(personalErrors);
    return Object.keys(personalErrors).length === 0;
  };

  const validateServiceFields = () => {
    const serviceErrors = {};
    const visibleFields = getVisibleItems(fields, formData);
    const visibleDocuments = getVisibleItems(documents, formData);

    console.log('🔍🔍🔍 [validateServiceFields] START Validation');
    console.log('  Visible Fields:', visibleFields.length);
    console.log('  Visible Documents:', visibleDocuments.length);
    console.log('  Current formData keys:', Object.keys(formData));

    visibleFields.forEach(field => {
      // Skip validation for display-only fields (info/label/header/divider)
      const displayOnlyTypes = ['info', 'label', 'heading', 'header', 'divider'];
      if (displayOnlyTypes.includes(field.field_type)) {
        console.log(`  ⏭️ Skipping display-only field: ${field.field_name} (${field.field_type})`);
        return;
      }

      const fieldValue = formData[field.field_name];
      const isEmpty = !fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '') || (Array.isArray(fieldValue) && fieldValue.length === 0);

      console.log(`  📝 [${field.field_name}] "${field.label_ar}" Type: ${field.field_type}, Required: ${field.is_required}, Value: ${fieldValue}, isEmpty: ${isEmpty}`);

      if (field.is_required && isEmpty) {
        serviceErrors[field.field_name] = `${field.label_ar} مطلوب`;
        console.log(`    ❌ VALIDATION FAILED: ${field.label_ar} is required but empty`);
      } else {
        console.log(`    ✅ VALIDATION PASSED`);
      }
    });

    visibleDocuments.forEach(doc => {
      const docValue = formData[`document_${doc.id}`];
      const hasFiles = Array.isArray(docValue) && docValue.length > 0 && docValue.some(file => file instanceof File || (file && file.url));

      console.log(`  📄 [document_${doc.id}] "${doc.document_name_ar}"`);
      console.log(`    - Required: ${doc.is_required}`);
      console.log(`    - Value:`, docValue);
      console.log(`    - Is Array: ${Array.isArray(docValue)}`);
      console.log(`    - Length: ${docValue?.length || 0}`);
      console.log(`    - Has Files: ${hasFiles}`);

      if (doc.is_required && !hasFiles) {
        serviceErrors[`document_${doc.id}`] = `${doc.document_name_ar} مطلوب`;
        console.log(`    ❌ VALIDATION FAILED: Document required but no files`);
      } else {
        console.log(`    ✅ VALIDATION PASSED`);
      }
    });

    console.log('📊 [validateServiceFields] Validation Summary:');
    console.log('  Total Errors:', Object.keys(serviceErrors).length);
    console.log('  Errors:', serviceErrors);

    setErrors(serviceErrors);

    if (Object.keys(serviceErrors).length > 0) {
      // عرض الأخطاء للمستخدم
      const errorList = Object.values(serviceErrors).join('\n');
      alert(`⚠️ يرجى إكمال الحقول المطلوبة:\n\n${errorList}`);

      // Scroll to first error
      const firstErrorField = Object.keys(serviceErrors)[0];
      setTimeout(() => {
        const errorElement = document.querySelector(`[name="${firstErrorField}"]`) ||
                            document.querySelector(`#${firstErrorField}`) ||
                            document.querySelector('[class*="border-red"]');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }

    return Object.keys(serviceErrors).length === 0;
  };

  const handleNext = () => {
    console.log('🚀🚀🚀 [handleNext] Clicked! Current step:', currentStep);

    if (currentStep === 0) {
      const isValid = validatePersonalInfo();
      console.log('📋 [handleNext] Personal info validation:', isValid ? '✅ PASSED' : '❌ FAILED');
      if (!isValid) return;
    }

    if (currentStep === 1) {
      const isValid = validateServiceFields();
      console.log('📝 [handleNext] Service fields validation:', isValid ? '✅ PASSED' : '❌ FAILED');
      if (!isValid) return;
    }

    if (currentStep < steps.length - 1) {
      console.log('➡️ [handleNext] Moving to step:', currentStep + 1);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (currentStep !== 2) return;

    // التحقق من الموافقة على جميع الشروط والأحكام
    const allTermsAccepted = Object.values(termsAccepted).every(value => value === true);

    if (!allTermsAccepted) {
      setErrors({
        terms: 'يجب الموافقة على جميع الشروط والأحكام قبل إرسال الطلب'
      });

      // Show alert
      alert('⚠️ يرجى الموافقة على جميع الشروط والأحكام قبل إرسال الطلب');

      // Scroll to terms section
      setTimeout(() => {
        const termsSection = document.querySelector('.bg-white.border');
        if (termsSection) {
          termsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      if (onSubmit) {
        await onSubmit({
          ...formData,
          serviceSlug
        });
      }
    } catch (err) {
      console.error('Error submitting:', err);
      alert('حدث خطأ أثناء الإرسال');
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem(`draft_${serviceSlug}`, JSON.stringify(formData));
    alert('تم حفظ المسودة بنجاح');
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#276073]" />
        <span className="mr-3 text-gray-600">جاري التحميل...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">حدث خطأ: {error}</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">الخدمة غير موجودة</p>
      </div>
    );
  }

  const serviceSteps = [...new Set(fields.map(f => f.step_id))].map(stepId => {
    const stepFields = fields.filter(f => f.step_id === stepId);
    return {
      id: stepId,
      title: stepFields[0]?.step_title_ar || stepId,
      fields: stepFields
    };
  });

  const renderPersonalInfoStep = () => {
    const personalFields = [
      { name: 'fullName', label: 'الاسم الرباعي حسب جواز السفر', type: 'text', required: true },
      { name: 'nationalId', label: 'رقم الجواز', type: 'text', required: true },
      { name: 'phoneNumber', label: 'رقم الجوال', type: 'tel', required: true, help: '+966 - رقم سعودي يبدأ بـ 05', prefix: '+966' },
      { name: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
      { name: 'dob', label: 'تاريخ الميلاد', type: 'date', required: true },
      { name: 'profession', label: 'المهنة', type: 'text', required: true },
      { name: 'region', label: 'المنطقة', type: 'searchable-select', options: getRegionsList(), required: true },
      { name: 'city', label: 'المدينة', type: 'searchable-select', options: availableCities, required: true },
      { name: 'district', label: 'الحي', type: 'searchable-select', options: availableDistricts, required: true },
      { name: 'address', label: 'العنوان / أقرب معلم', type: 'textarea', required: true },
      { name: 'workplace', label: 'مكان العمل', type: 'text', required: true }
    ];

    return (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">بيانات المتقدم</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {personalFields.map(field => {
            const FieldComponent = fieldComponents[field.type];
            if (!FieldComponent) return null;

            return (
              <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                <FieldComponent
                  field={field}
                  name={field.name}
                  label={field.label}
                  placeholder={field.placeholder}
                  help={field.help}
                  options={field.options}
                  required={field.required}
                  value={formData[field.name]}
                  onChange={(value) => handleInputChange(field.name, value)}
                  error={errors[field.name]}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderServiceFieldsStep = () => {
    console.log('🔍 [renderServiceFieldsStep] RAW DATA CHECK:', {
      fieldsLength: fields?.length || 0,
      fieldsType: Array.isArray(fields) ? 'array' : typeof fields,
      firstField: fields?.[0],
      documentsLength: documents?.length || 0
    });

    console.log('🔥 CALLING getVisibleItems for FIELDS with:', {
      fieldsCount: fields?.length,
      formDataKeys: Object.keys(formData)
    });
    const visibleFields = getVisibleItems(fields, formData);
    console.log('🔥 RESULT from getVisibleItems for FIELDS:', {
      visibleCount: visibleFields?.length,
      visibleNames: visibleFields?.map(f => f?.field_name || f?.label_ar)
    });

    const visibleDocuments = getVisibleItems(documents, formData);

    console.log('🟢🟢🟢 [renderServiceFieldsStep] ===== START RENDER =====');
    console.log('📋 [renderServiceFieldsStep] Current formData:', {
      isAdult: formData.isAdult,
      passportType: formData.passportType,
      totalFields: Object.keys(formData).length
    });
    console.log('📄 [renderServiceFieldsStep] Documents Status:', {
      totalDocumentsInDB: documents.length,
      visibleDocumentsCount: visibleDocuments.length,
      visibleDocumentsNames: visibleDocuments.map(d => d.document_name_ar),
      willShowDocumentsSection: visibleDocuments.length > 0
    });
    console.log('📝 [renderServiceFieldsStep] Fields Status:', {
      totalFieldsInDB: fields.length,
      visibleFieldsCount: visibleFields.length,
      visibleFieldsNames: visibleFields.map(f => f.label_ar),
      firstFieldSample: fields[0]
    });

    if (!visibleFields.length && !visibleDocuments.length) {
      console.log('🔴 [renderServiceFieldsStep] Showing "no fields" message - NO DOCUMENTS WILL SHOW!');
      return (
        <div className="text-center py-8">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا توجد حقول إضافية</h3>
          <p className="text-gray-600">يمكنك المتابعة للمراجعة</p>
        </div>
      );
    }

    console.log('✅ [renderServiceFieldsStep] Will render form with documents section!');

    return (
      <div className="space-y-8">
        {visibleFields.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-6">تفاصيل الخدمة</h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {visibleFields.map(field => {
                const FieldComponent = fieldComponents[field.field_type];
                if (!FieldComponent) return null;

                // Calculate grid column span based on field_width
                const getColumnSpan = (width) => {
                  switch(width) {
                    case 'half': return 'md:col-span-6';
                    case 'third': return 'md:col-span-4';
                    case 'two-thirds': return 'md:col-span-8';
                    case 'quarter': return 'md:col-span-3';
                    case 'three-quarters': return 'md:col-span-9';
                    case 'full':
                    default: return 'md:col-span-12';
                  }
                };

                // Calculate margin classes
                const getMarginClass = (margin) => {
                  switch(margin) {
                    case 'none': return '';
                    case 'small': return 'mb-2';
                    case 'large': return 'mb-8';
                    case 'normal':
                    default: return 'mb-4';
                  }
                };

                // Calculate height classes for textarea/file
                const getHeightClass = (height, fieldType) => {
                  if (fieldType !== 'textarea' && fieldType !== 'file') return '';
                  switch(height) {
                    case 'small': return 'h-20';
                    case 'large': return 'h-48';
                    case 'xlarge': return 'h-72';
                    case 'medium':
                    default: return 'h-32';
                  }
                };

                const colSpan = getColumnSpan(field.field_width);
                const marginClass = getMarginClass(field.field_margin);
                const breakLine = field.break_line ? 'md:col-span-12' : colSpan;
                const heightClass = getHeightClass(field.field_height, field.field_type);

                return (
                  <div
                    key={field.id}
                    className={`${breakLine} ${marginClass}`}
                  >
                    <FieldComponent
                      field={{
                        ...field,
                        name: field.field_name,
                        label: field.label_ar,
                        placeholder: field.placeholder_ar,
                        help: field.help_text_ar || field.help_text_en,
                        type: field.field_type,
                        required: field.is_required,
                        subfields: field.subfields,
                        heightClass: heightClass
                      }}
                      name={field.field_name}
                      label={field.label_ar}
                      placeholder={field.placeholder_ar}
                      help={field.help_text_ar || field.help_text_en}
                      options={field.options}
                      required={field.is_required}
                      value={formData[field.field_name]}
                      onChange={(value) => handleInputChange(field.field_name, value)}
                      error={errors[field.field_name]}
                      heightClass={heightClass}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {visibleDocuments.length > 0 && (
          <div>
            {console.log('🎉🎉🎉 [DOCUMENTS SECTION RENDERING] Showing', visibleDocuments.length, 'documents!')}
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#276073]" />
              المستندات المطلوبة ({visibleDocuments.length})
            </h3>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-base font-bold text-amber-900 mb-2">
                    ✨ يرجى رفع جميع المستندات المطلوبة ({visibleDocuments.length} مستند)
                  </p>
                  <p className="text-sm text-amber-800">
                    تأكد من وضوح الصور والمستندات، والصيغ المقبولة: PDF, JPG, JPEG, PNG
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              {visibleDocuments.map((doc, index) => {
                console.log(`📄 [Document ${index + 1}/${visibleDocuments.length}] Rendering:`, doc.document_name_ar);
                return (
                <div key={doc.id} className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-[#276073] transition-colors duration-200">
                  <div className="mb-4">
                    <div className="flex items-start gap-3 mb-2">
                      {doc.is_required ? (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full">
                          <AlertCircle className="w-3 h-3" />
                          إلزامي
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                          اختياري
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-1">{doc.document_name_ar}</h4>
                    {doc.description_ar && (
                      <p className="text-sm text-gray-600 mb-2">{doc.description_ar}</p>
                    )}
                    {doc.accepted_formats && (
                      <p className="text-xs text-gray-500">
                        الصيغ المقبولة: {doc.accepted_formats.join(', ').toUpperCase()}
                      </p>
                    )}
                  </div>
                  <FileField
                    field={{
                      name: `document_${doc.id}`,
                      label: '',
                      required: doc.is_required,
                      accept: doc.accepted_formats ? doc.accepted_formats.map(f => `.${f}`).join(',') : '.pdf,.jpg,.jpeg,.png'
                    }}
                    name={`document_${doc.id}`}
                    required={doc.is_required}
                    value={formData[`document_${doc.id}`]}
                    onChange={(value) => {
                      handleInputChange(`document_${doc.id}`, value);
                      handleInputChange(`document_${doc.id}_label`, doc.document_name_ar || 'مستند');
                    }}
                    error={errors[`document_${doc.id}`]}
                  />
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderReviewStep = () => {
    const visibleDocuments = getVisibleItems(documents, formData);
    const visibleFields = getVisibleItems(fields, formData);
    const personalInfoKeys = ['fullName', 'nationalId', 'phoneNumber', 'email', 'dob', 'isAdult', 'region', 'city', 'district', 'address', 'profession', 'workplace'];
    const documentKeys = Object.keys(formData).filter(key => key.startsWith('document_'));

    return (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">مراجعة البيانات</h3>

        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">بيانات المتقدم</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-b border-gray-200 pb-2">
              <dt className="text-sm font-medium text-gray-600">الاسم الرباعي</dt>
              <dd className="text-sm text-gray-900">{formData.fullName || '-'}</dd>
            </div>
            <div className="border-b border-gray-200 pb-2">
              <dt className="text-sm font-medium text-gray-600">رقم الجواز</dt>
              <dd className="text-sm text-gray-900">{formData.nationalId || '-'}</dd>
            </div>
            <div className="border-b border-gray-200 pb-2">
              <dt className="text-sm font-medium text-gray-600">رقم الجوال</dt>
              <dd className="text-sm text-gray-900">{formData.phoneNumber || '-'}</dd>
            </div>
            <div className="border-b border-gray-200 pb-2">
              <dt className="text-sm font-medium text-gray-600">البريد الإلكتروني</dt>
              <dd className="text-sm text-gray-900">{formData.email || '-'}</dd>
            </div>
          </div>
        </div>

        {visibleFields.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-4">تفاصيل الخدمة</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleFields.map(field => (
                <div key={field.id} className="border-b border-gray-200 pb-2">
                  <dt className="text-sm font-medium text-gray-600">{field.label_ar}</dt>
                  <dd className="text-sm text-gray-900">
                    {Array.isArray(formData[field.field_name])
                      ? formData[field.field_name].length + ' عنصر'
                      : formData[field.field_name] || '-'}
                  </dd>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleDocuments.length > 0 && documentKeys.length > 0 && (
          <div className="bg-green-50 rounded-lg p-6 border-2 border-green-200">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              المستندات المرفوعة
            </h4>
            <div className="space-y-3">
              {visibleDocuments.map(doc => {
                const documentValue = formData[`document_${doc.id}`];
                return (
                  <div key={doc.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.document_name_ar}</p>
                        {documentValue && Array.isArray(documentValue) && (
                          <p className="text-xs text-gray-500">{documentValue.length} ملف</p>
                        )}
                      </div>
                    </div>
                    {documentValue ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#276073]" />
            الشروط والأحكام
          </h4>

          {errors.terms && (
            <div className="mb-4 p-5 bg-red-50 border-2 border-red-400 rounded-lg flex items-start gap-3 shadow-md">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="text-base text-red-900 font-bold mb-1">تنبيه مهم</p>
                <p className="text-sm text-red-800 font-medium">{errors.terms}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border transition-all ${
              termsAccepted.dataAccuracy
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400 bg-white'
            }`}>
              <input
                type="checkbox"
                checked={termsAccepted.dataAccuracy}
                onChange={(e) => setTermsAccepted(prev => ({ ...prev, dataAccuracy: e.target.checked }))}
                className="w-5 h-5 text-green-600 border-2 border-gray-400 rounded cursor-pointer flex-shrink-0"
              />
              <span className="text-gray-800 text-base flex-1 text-right">
                أقر بأن جميع البيانات المدخلة صحيحة ودقيقة
              </span>
            </label>

            <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border transition-all ${
              termsAccepted.termsAndConditions
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400 bg-white'
            }`}>
              <input
                type="checkbox"
                checked={termsAccepted.termsAndConditions}
                onChange={(e) => setTermsAccepted(prev => ({ ...prev, termsAndConditions: e.target.checked }))}
                className="w-5 h-5 text-green-600 border-2 border-gray-400 rounded cursor-pointer flex-shrink-0"
              />
              <span className="text-gray-800 text-base flex-1 text-right">
                أوافق على الشروط والأحكام الخاصة بالخدمة
              </span>
            </label>

            <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border transition-all ${
              termsAccepted.communicationConsent
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400 bg-white'
            }`}>
              <input
                type="checkbox"
                checked={termsAccepted.communicationConsent}
                onChange={(e) => setTermsAccepted(prev => ({ ...prev, communicationConsent: e.target.checked }))}
                className="w-5 h-5 text-green-600 border-2 border-gray-400 rounded cursor-pointer flex-shrink-0"
              />
              <span className="text-gray-800 text-base flex-1 text-right">
                أوافق على التواصل معي عبر البريد الإلكتروني أو الهاتف لمتابعة الطلب
              </span>
            </label>
          </div>

          {!Object.values(termsAccepted).every(v => v === true) && (
            <div className="mt-6 p-5 bg-yellow-50 border-2 border-yellow-300 rounded-xl shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-700 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-base font-bold text-yellow-900 mb-1">
                    تنبيه هام
                  </p>
                  <p className="text-sm text-yellow-800 leading-relaxed">
                    لن تتمكن من إرسال الطلب إلا بعد الموافقة على <span className="font-bold underline">جميع</span> الشروط والأحكام أعلاه. يرجى قراءة كل شرط بعناية والتأشير عليه.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderPersonalInfoStep();
      case 1:
        return renderServiceFieldsStep();
      case 2:
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-4 gap-8">
        {/* Sidebar - Hidden on mobile and tablet, visible on desktop */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="space-y-6 sticky top-6">
            <SidebarSummary
              service={service}
              formData={formData}
              pricingRules={pricingRules}
              requirements={requirements}
            />
          </div>
        </div>

        {/* Main Form - Full width on mobile/tablet, 3 columns on desktop */}
        <div className="lg:col-span-3 w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-200 p-6">
              <ProgressSteps steps={steps} currentStep={currentStep} />
            </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={fillTestData}
                    className="group flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border-2 border-orange-400 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    <TestTube2 className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">تعبئة بيانات تجريبية</span>
                  </button>

                  <button
                    onClick={handleSaveDraft}
                    className="flex items-center space-x-2 rtl:space-x-reverse text-gray-600 hover:text-gray-800 transition-colors duration-200"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ كمسودة</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center space-x-2 rtl:space-x-reverse text-gray-600 hover:text-gray-800 transition-colors duration-200"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة</span>
                  </button>
                </div>

                <div className="flex space-x-4 rtl:space-x-reverse">
                  {currentStep > 0 && (
                    <button
                      onClick={handlePrevious}
                      className="flex items-center space-x-2 rtl:space-x-reverse bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
                    >
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                      <span>السابق</span>
                    </button>
                  )}

                  {currentStep < steps.length - 1 ? (
                    <button
                      onClick={handleNext}
                      className="flex items-center space-x-2 rtl:space-x-reverse bg-[#276073] hover:bg-[#1e4a5a] text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
                    >
                      <span>التالي</span>
                      <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !Object.values(termsAccepted).every(v => v === true)}
                      className={`flex items-center space-x-2 rtl:space-x-reverse px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                        isSubmitting || !Object.values(termsAccepted).every(v => v === true)
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      } text-white`}
                      title={!Object.values(termsAccepted).every(v => v === true) ? 'يجب الموافقة على جميع الشروط والأحكام أولاً' : ''}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>جاري الإرسال...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>إرسال الطلب</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
